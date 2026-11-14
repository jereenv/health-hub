import { openTestDatabase } from '@/test-support/sqljsDatabase';

import { createSqliteHealthConnectRepository } from './HealthConnectRepository';
import type { ImportPayload, SleepSessionRow } from './HealthConnectRepository';

const AT = '2026-11-13T10:00:00.000Z';

function sleep(hcId: string, wakeDate: string, endAt: string): SleepSessionRow {
  return {
    hcId,
    startAt: '2026-01-01T00:00:00.000Z',
    endAt,
    wakeDate,
    asleepS: 25_000,
    awakeS: 1_200,
    lightS: 14_000,
    deepS: 5_000,
    remS: 6_000,
    hasStages: true,
  };
}

function payload(overrides: Partial<ImportPayload> = {}): ImportPayload {
  return {
    from: '2026-11-01',
    activity: [
      { date: '2026-11-02', steps: 1000, distanceM: 800.5, activeKcal: null, totalKcal: 2000 },
      { date: '2026-11-01', steps: 2000, distanceM: null, activeKcal: 50, totalKcal: null },
    ],
    sleep: [
      sleep('s2', '2026-11-02', '2026-11-02T11:00:00.000Z'),
      sleep('s1', '2026-11-01', '2026-11-01T11:00:00.000Z'),
    ],
    heartRate: [
      { date: '2026-11-02', minBpm: 50, avgBpm: 70.5, maxBpm: 150 },
      { date: '2026-11-01', minBpm: 51, avgBpm: 71.5, maxBpm: 151 },
    ],
    watchBodyFat: [
      { hcId: 'f2', measuredAt: '2026-10-28T12:00:00.000Z', bodyFatPct: 20, origin: 'watch' },
      { hcId: 'f1', measuredAt: '2026-01-16T12:00:00.000Z', bodyFatPct: 21, origin: 'watch' },
    ],
    weighIns: [
      {
        measuredAt: '2026-11-02T12:00:00.000Z',
        weightKg: 80.1,
        sourceRecordId: 'w2',
        rawPayload: '{}',
        bodyFatPct: null,
      },
      {
        measuredAt: '2026-11-01T12:00:00.000Z',
        weightKg: 80.5,
        sourceRecordId: 'w1',
        rawPayload: '{"weightRecordIds":["w1"]}',
        bodyFatPct: 18.5,
      },
    ],
    syncedAt: AT,
    ...overrides,
  };
}

async function setup() {
  const db = await openTestDatabase();
  return { db, repo: createSqliteHealthConnectRepository(db) };
}

test('applyImport stores every row type and the lists read them back in order', async () => {
  const { repo } = await setup();
  await repo.applyImport(payload());

  expect((await repo.listActivityDays()).map((d) => d.date)).toEqual(['2026-11-01', '2026-11-02']);
  expect((await repo.listActivityDays())[1]).toEqual({
    date: '2026-11-02',
    steps: 1000,
    distanceM: 800.5,
    activeKcal: null,
    totalKcal: 2000,
  });
  const sessions = await repo.listSleepSessions();
  expect(sessions.map((s) => s.hcId)).toEqual(['s1', 's2']);
  expect(sessions[0]).toEqual(sleep('s1', '2026-11-01', '2026-11-01T11:00:00.000Z'));
  expect((await repo.listHeartRateDays()).map((h) => h.date)).toEqual(['2026-11-01', '2026-11-02']);
  expect((await repo.listWatchBodyFat()).map((f) => f.hcId)).toEqual(['f1', 'f2']);
  expect(await repo.listScaleReadings()).toEqual([
    {
      id: expect.any(Number),
      measuredAt: '2026-11-01T12:00:00.000Z',
      weightKg: 80.5,
      source: 'health_connect',
      bodyFatPct: 18.5,
    },
    {
      id: expect.any(Number),
      measuredAt: '2026-11-02T12:00:00.000Z',
      weightKg: 80.1,
      source: 'health_connect',
      bodyFatPct: null,
    },
  ]);
  expect(await repo.counts()).toEqual({
    activityDays: 2,
    sleepSessions: 2,
    heartRateDays: 2,
    watchBodyFat: 2,
    weighIns: 2,
  });
});

test('applyImport replaces activity, sleep and heart-rate rows from the window start and keeps older rows', async () => {
  const { repo } = await setup();
  await repo.applyImport(
    payload({
      from: '2026-10-01',
      activity: [
        { date: '2026-10-30', steps: 10, distanceM: null, activeKcal: null, totalKcal: null },
        { date: '2026-11-01', steps: 20, distanceM: null, activeKcal: null, totalKcal: null },
      ],
      sleep: [
        sleep('old', '2026-10-30', '2026-10-30T11:00:00.000Z'),
        sleep('new', '2026-11-01', '2026-11-01T11:00:00.000Z'),
      ],
      heartRate: [
        { date: '2026-10-30', minBpm: 40, avgBpm: 60, maxBpm: 100 },
        { date: '2026-11-01', minBpm: 41, avgBpm: 61, maxBpm: 101 },
      ],
    }),
  );
  await repo.applyImport(
    payload({
      from: '2026-11-01',
      activity: [
        { date: '2026-11-01', steps: 99, distanceM: null, activeKcal: null, totalKcal: null },
      ],
      sleep: [sleep('newer', '2026-11-01', '2026-11-01T12:00:00.000Z')],
      heartRate: [{ date: '2026-11-01', minBpm: 45, avgBpm: 65, maxBpm: 105 }],
    }),
  );

  expect((await repo.listActivityDays()).map((d) => [d.date, d.steps])).toEqual([
    ['2026-10-30', 10],
    ['2026-11-01', 99],
  ]);
  expect((await repo.listSleepSessions()).map((s) => s.hcId)).toEqual(['old', 'newer']);
  expect((await repo.listHeartRateDays()).map((h) => [h.date, h.minBpm])).toEqual([
    ['2026-10-30', 40],
    ['2026-11-01', 45],
  ]);
});

test('applyImport removes a sleep session that is no longer in the payload', async () => {
  const { repo } = await setup();
  await repo.applyImport(payload());
  await repo.applyImport(
    payload({ sleep: [sleep('s1', '2026-11-01', '2026-11-01T11:00:00.000Z')] }),
  );
  expect((await repo.listSleepSessions()).map((s) => s.hcId)).toEqual(['s1']);
});

test('applyImport rebuilds health_connect scale readings and their legacy body fat, and keeps a ble reading', async () => {
  const { db, repo } = await setup();
  await db.run(
    `INSERT INTO scale_reading (measured_at, weight_kg, source, source_record_id)
     VALUES ('2026-11-03T08:00:00.000Z', 79.9, 'ble', 'b1')`,
  );
  await repo.applyImport(payload());
  await repo.applyImport(payload({ weighIns: [payload().weighIns[1]!] }));

  const readings = await repo.listScaleReadings();
  expect(readings.map((r) => r.source)).toEqual(['health_connect', 'ble']);
  const legacy = await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM legacy_body_value');
  expect(legacy?.n).toBe(1);
});

test('a weigh-in without body fat has no legacy_body_value row; with it, metric body_fat_pct and origin movinglife', async () => {
  const { db, repo } = await setup();
  await repo.applyImport(payload());
  const rows = await db.all<{ metric: string; value: number; origin: string }>(
    'SELECT metric, value, origin FROM legacy_body_value',
  );
  expect(rows).toEqual([{ metric: 'body_fat_pct', value: 18.5, origin: 'movinglife' }]);
});

test('applyImport is atomic: a failure on the last insert leaves the previous data intact', async () => {
  const { repo } = await setup();
  await repo.applyImport(payload());
  const before = {
    activity: await repo.listActivityDays(),
    sleep: await repo.listSleepSessions(),
    scale: await repo.listScaleReadings(),
    fat: await repo.listWatchBodyFat(),
  };
  const duplicate = sleep('dup', '2026-11-05', '2026-11-05T11:00:00.000Z');
  await expect(
    repo.applyImport(payload({ from: '2026-10-01', sleep: [duplicate, duplicate] })),
  ).rejects.toThrow();
  expect({
    activity: await repo.listActivityDays(),
    sleep: await repo.listSleepSessions(),
    scale: await repo.listScaleReadings(),
    fat: await repo.listWatchBodyFat(),
  }).toEqual(before);
});

test('applying the same payload twice leaves identical rows', async () => {
  const { repo } = await setup();
  await repo.applyImport(payload());
  const first = {
    activity: await repo.listActivityDays(),
    sleep: await repo.listSleepSessions(),
    heart: await repo.listHeartRateDays(),
    fat: await repo.listWatchBodyFat(),
    counts: await repo.counts(),
    scale: (await repo.listScaleReadings()).map(({ id: _id, ...rest }) => rest),
  };
  await repo.applyImport(payload());
  expect({
    activity: await repo.listActivityDays(),
    sleep: await repo.listSleepSessions(),
    heart: await repo.listHeartRateDays(),
    fat: await repo.listWatchBodyFat(),
    counts: await repo.counts(),
    scale: (await repo.listScaleReadings()).map(({ id: _id, ...rest }) => rest),
  }).toEqual(first);
});

test('applyImport drops an imported weigh-in that matches a ble reading and its legacy body fat', async () => {
  const { db, repo } = await setup();
  await db.run(
    `INSERT INTO scale_reading (measured_at, weight_kg, source, source_record_id)
     VALUES ('2026-11-01T12:01:00.000Z', 80.5, 'ble', 'b1')`,
  );
  await repo.applyImport(payload());

  const readings = await repo.listScaleReadings();
  expect(readings.map((r) => r.source)).toEqual(['ble', 'health_connect']);
  expect(readings.map((r) => r.measuredAt)).toEqual([
    '2026-11-01T12:01:00.000Z',
    '2026-11-02T12:00:00.000Z',
  ]);
  const legacy = await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM legacy_body_value');
  expect(legacy?.n).toBe(0);
});

test('applyImport keeps a ble reading and an unmatched imported one', async () => {
  const { db, repo } = await setup();
  await db.run(
    `INSERT INTO scale_reading (measured_at, weight_kg, source, source_record_id)
     VALUES ('2026-11-01T12:00:00.000Z', 90, 'ble', 'b1')`,
  );
  await repo.applyImport(payload());

  const readings = await repo.listScaleReadings();
  expect(readings.map((r) => r.source)).toEqual(['ble', 'health_connect', 'health_connect']);
});
