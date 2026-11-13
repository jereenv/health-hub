import { createSqliteSyncStateRepository } from '@/data/sync/SyncStateRepository';
import { addDays } from '@/domain/time/localDate';
import type { DateKey } from '@/domain/time/localDate';
import { openTestDatabase } from '@/test-support/sqljsDatabase';

import { CHUNK_DAYS, MOVINGLIFE_ORIGIN, SAMSUNG_HEALTH_ORIGIN } from './constants';
import type {
  BodyRecord,
  DailyKind,
  DateRange,
  HealthConnectAccess,
  HealthConnectAvailability,
  HealthConnectGateway,
  SleepRecord,
} from './HealthConnectGateway';
import { createSqliteHealthConnectRepository } from './HealthConnectRepository';
import { syncHealthConnect } from './healthConnectSync';

/** 15:00 UTC on 13 November 2026 is 10:00 in New York, so today is 2026-11-13. */
const NOW = new Date('2026-11-13T15:00:00.000Z');
const TODAY = '2026-11-13';

/** Fake data a day at a time; the fake answers like Health Connect, only for days in the range. */
interface FakeData {
  availability: HealthConnectAvailability;
  access: HealthConnectAccess;
  earliest: DateKey | null;
  steps: Record<DateKey, number>;
  totalKcal: Record<DateKey, number>;
  heartRate: Record<DateKey, number>;
  sleep: SleepRecord[];
  weights: BodyRecord[];
  bodyFat: BodyRecord[];
  failWith: Error | null;
}

const ACCESS: HealthConnectAccess = { readAll: true, history: true, missing: [] };

function sleepAt(id: string, endDay: DateKey): SleepRecord {
  return {
    hcId: id,
    startAt: `${addDays(endDay, -1)}T03:00:00.000Z`,
    endAt: `${endDay}T11:00:00.000Z`,
    stages: [],
  };
}

function weigh(id: string, time: string, value: number): BodyRecord {
  return { hcId: id, time, origin: MOVINGLIFE_ORIGIN, value };
}

function inRange(date: DateKey, range: DateRange): boolean {
  return date >= range.from && date < range.toExclusive;
}

function makeFake(overrides: Partial<FakeData> = {}) {
  const data: FakeData = {
    availability: 'available',
    access: ACCESS,
    earliest: '2026-10-20',
    steps: { '2026-10-20': 100, '2026-11-05': 200, '2026-11-12': 300 },
    totalKcal: { '2026-11-12': 2000 },
    heartRate: { '2026-11-12': 60 },
    sleep: [sleepAt('old', '2026-10-25'), sleepAt('recent', '2026-11-10')],
    weights: [weigh('w1', '2026-11-01T12:00:00.000Z', 80)],
    bodyFat: [],
    failWith: null,
    ...overrides,
  };
  const calls = { dailyRanges: [] as DateRange[], earliest: 0 };
  const gateway: HealthConnectGateway = {
    async availability() {
      return data.availability;
    },
    async getAccess() {
      return data.access;
    },
    async requestAccess() {
      return data.access;
    },
    async earliestDate() {
      calls.earliest += 1;
      return data.earliest;
    },
    async dailyValues(kind: DailyKind, range) {
      if (data.failWith) throw data.failWith;
      calls.dailyRanges.push(range);
      const source = kind === 'steps' ? data.steps : kind === 'totalKcal' ? data.totalKcal : {};
      return Object.entries(source)
        .filter(([date]) => inRange(date, range))
        .map(([date, value]) => ({ date, value }));
    },
    async dailyHeartRate(range) {
      return Object.entries(data.heartRate)
        .filter(([date]) => inRange(date, range))
        .map(([date, avg]) => ({ date, minBpm: avg - 10, avgBpm: avg, maxBpm: avg + 90 }));
    },
    async sleepRecords(range) {
      return data.sleep.filter((record) => inRange(record.endAt.slice(0, 10), range));
    },
    async bodyRecords(kind) {
      return kind === 'weight' ? data.weights : data.bodyFat;
    },
    openSettings() {},
  };
  return { data, calls, gateway };
}

async function setup(overrides: Partial<FakeData> = {}) {
  const db = await openTestDatabase();
  const repository = createSqliteHealthConnectRepository(db);
  const syncState = createSqliteSyncStateRepository(db);
  const fake = makeFake(overrides);
  const run = (now = NOW, gateway = fake.gateway) =>
    syncHealthConnect({ gateway, repository, syncState, now: () => now });
  const snapshot = async () => ({
    activity: await repository.listActivityDays(),
    sleep: await repository.listSleepSessions(),
    heart: await repository.listHeartRateDays(),
    fat: await repository.listWatchBodyFat(),
    scale: (await repository.listScaleReadings()).map(({ id: _id, ...rest }) => rest),
  });
  return { db, repository, syncState, fake, run, snapshot };
}

test('first run imports everything from the earliest record and saves a cursor with history true', async () => {
  const { run, syncState, repository } = await setup();
  const result = await run();
  expect(result).toEqual({
    status: 'ok',
    mode: 'full',
    from: '2026-10-20',
    activityDays: 3,
    sleepSessions: 2,
    heartRateDays: 1,
    weighIns: 1,
    watchBodyFat: 0,
    ignored: 0,
  });
  expect((await repository.listActivityDays()).find((d) => d.date === '2026-11-12')).toEqual({
    date: '2026-11-12',
    steps: 300,
    distanceM: null,
    activeKcal: null,
    totalKcal: 2000,
  });
  const state = await syncState.get('health_connect');
  expect(JSON.parse(state.cursor ?? 'null')).toEqual({
    v: 1,
    syncedThrough: TODAY,
    history: true,
  });
  expect(state.lastSuccessAt).toBe(NOW.toISOString());
});

test('a second run with the same data leaves identical rows', async () => {
  const { run, snapshot } = await setup();
  await run();
  const first = await snapshot();
  const second = await run();
  expect(second).toMatchObject({ status: 'ok', mode: 'incremental' });
  expect(await snapshot()).toEqual(first);
});

test('a second run replaces only the trailing 14 days and keeps older rows', async () => {
  const { run, fake, repository } = await setup();
  await run();
  // The window starts 2026-10-30. A change before it is not re-read; one after it is.
  fake.data.steps = { '2026-10-20': 111, '2026-11-05': 222, '2026-11-12': 333 };
  const result = await run();
  expect(result).toMatchObject({ mode: 'incremental', from: '2026-10-30' });
  expect((await repository.listActivityDays()).map((d) => [d.date, d.steps])).toEqual([
    ['2026-10-20', 100],
    ['2026-11-05', 222],
    ['2026-11-12', 333],
  ]);
});

test('a session removed from Health Connect inside the window is deleted, one older than the window is kept', async () => {
  const { run, fake, repository } = await setup();
  await run();
  fake.data.sleep = [];
  await run();
  expect((await repository.listSleepSessions()).map((s) => s.hcId)).toEqual(['old']);
});

test('a changed daily total inside the window is updated', async () => {
  const { run, fake, repository } = await setup();
  await run();
  fake.data.totalKcal = { '2026-11-12': 2500 };
  await run(new Date('2026-11-14T15:00:00.000Z'));
  const day = (await repository.listActivityDays()).find((d) => d.date === '2026-11-12');
  expect(day?.totalKcal).toBe(2500);
});

test('history granted after a run without it triggers a full import', async () => {
  const { run, fake, syncState, repository } = await setup({
    access: { readAll: true, history: false, missing: [] },
    earliest: null,
    steps: { '2026-09-01': 50, '2026-11-12': 300 },
  });
  const first = await run();
  expect(first).toMatchObject({ mode: 'full', from: '2026-10-14' });
  expect(JSON.parse((await syncState.get('health_connect')).cursor ?? 'null').history).toBe(false);
  expect((await repository.listActivityDays()).map((d) => d.date)).toEqual(['2026-11-12']);

  fake.data.access = ACCESS;
  fake.data.earliest = '2026-09-01';
  const second = await run();
  expect(second).toMatchObject({ mode: 'full', from: '2026-09-01' });
  expect((await repository.listActivityDays()).map((d) => d.date)).toContain('2026-09-01');
  expect(JSON.parse((await syncState.get('health_connect')).cursor ?? 'null').history).toBe(true);
});

test('missing read permission returns not_connected/no_permission and writes nothing', async () => {
  const { run, syncState, repository } = await setup({
    access: { readAll: false, history: false, missing: ['Steps'] },
  });
  expect(await run()).toEqual({ status: 'not_connected', reason: 'no_permission' });
  expect(await repository.counts()).toEqual({
    activityDays: 0,
    sleepSessions: 0,
    heartRateDays: 0,
    watchBodyFat: 0,
    weighIns: 0,
  });
  expect(await syncState.get('health_connect')).toMatchObject({
    cursor: null,
    lastSuccessAt: null,
    lastError: null,
  });
});

test.each(['not_installed', 'update_required', 'unavailable'] as const)(
  'unavailable Health Connect returns not_connected with the reason %s',
  async (availability) => {
    const { run, syncState } = await setup({ availability });
    expect(await run()).toEqual({ status: 'not_connected', reason: availability });
    expect((await syncState.get('health_connect')).lastError).toBeNull();
  },
);

test('a not_connected run leaves earlier state untouched', async () => {
  const { run, fake, syncState, snapshot } = await setup();
  await run();
  const before = await snapshot();
  const state = await syncState.get('health_connect');
  fake.data.availability = 'unavailable';
  await run();
  expect(await snapshot()).toEqual(before);
  expect(await syncState.get('health_connect')).toEqual(state);
});

test('a gateway error returns error, records it, leaves earlier data and keeps the old cursor', async () => {
  const { run, fake, syncState, snapshot } = await setup();
  await run();
  const before = await snapshot();
  const cursor = (await syncState.get('health_connect')).cursor;
  fake.data.failWith = new Error('boom');
  expect(await run(new Date('2026-11-14T15:00:00.000Z'))).toEqual({
    status: 'error',
    message: 'boom',
  });
  const state = await syncState.get('health_connect');
  expect(state.lastError).toBe('boom');
  expect(state.cursor).toBe(cursor);
  expect(state.lastSuccessAt).toBe(NOW.toISOString());
  expect(await snapshot()).toEqual(before);
});

test('a failure in the database write rolls back and leaves the cursor unsaved', async () => {
  const { run, fake, syncState, snapshot } = await setup();
  await run();
  const before = await snapshot();
  const cursor = (await syncState.get('health_connect')).cursor;
  // Two Samsung body-fat records with one id: the last insert violates the primary key.
  fake.data.bodyFat = [
    { hcId: 'dup', time: '2026-11-01T12:00:00.000Z', origin: SAMSUNG_HEALTH_ORIGIN, value: 20 },
    { hcId: 'dup', time: '2026-11-02T12:00:00.000Z', origin: SAMSUNG_HEALTH_ORIGIN, value: 21 },
  ];
  fake.data.steps = { '2026-11-12': 999 };
  const result = await run(new Date('2026-11-14T15:00:00.000Z'));
  expect(result.status).toBe('error');
  expect(await snapshot()).toEqual(before);
  const state = await syncState.get('health_connect');
  expect(state.cursor).toBe(cursor);
  expect(state.lastError).not.toBeNull();
});

test('weigh-ins and watch body fat are rebuilt from the full body record lists every run', async () => {
  const { run, fake, repository } = await setup({
    bodyFat: [
      { hcId: 'f1', time: '2026-11-01T12:01:00.000Z', origin: MOVINGLIFE_ORIGIN, value: 18 },
      { hcId: 'sf', time: '2026-03-01T12:00:00.000Z', origin: SAMSUNG_HEALTH_ORIGIN, value: 22 },
    ],
  });
  await run();
  expect((await repository.listScaleReadings()).map((r) => [r.weightKg, r.bodyFatPct])).toEqual([
    [80, 18],
  ]);
  expect((await repository.listWatchBodyFat()).map((f) => f.hcId)).toEqual(['sf']);

  // A weigh-in far outside the 14-day window is still rebuilt, and the removed one disappears.
  fake.data.weights = [weigh('w2', '2026-06-01T12:00:00.000Z', 79)];
  fake.data.bodyFat = [];
  await run();
  expect((await repository.listScaleReadings()).map((r) => [r.weightKg, r.bodyFatPct])).toEqual([
    [79, null],
  ]);
  expect(await repository.listWatchBodyFat()).toEqual([]);
});

test('long ranges are fetched in chunks of at most 92 days', async () => {
  const { run, fake } = await setup({ earliest: '2026-01-01' });
  await run();
  const ranges = fake.calls.dailyRanges.filter((_, index) => index % 4 === 0);
  expect(ranges.length).toBeGreaterThan(1);
  let next = '2026-01-01';
  for (const range of ranges) {
    expect(range.from).toBe(next);
    const days = (Date.parse(range.toExclusive) - Date.parse(range.from)) / 86_400_000;
    expect(days).toBeGreaterThan(0);
    expect(days).toBeLessThanOrEqual(CHUNK_DAYS);
    next = range.toExclusive;
  }
  expect(next).toBe('2026-11-14');
});

test('earliestDate is only asked on a full import', async () => {
  const { run, fake } = await setup();
  await run();
  await run();
  expect(fake.calls.earliest).toBe(1);
});
