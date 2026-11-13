import { createSqliteSettingsRepository } from '@/data/settings/SettingsRepository';
import { createSqliteSyncStateRepository } from '@/data/sync/SyncStateRepository';
import { createSqliteWorkoutRepository } from '@/data/workouts/sqliteWorkoutRepository';
import { SECRET_KEYS, type SecretStore } from '@/data/secrets/SecretStore';
import { InMemorySecretStore } from '@/test-support/InMemorySecretStore';
import { openTestDatabase } from '@/test-support/sqljsDatabase';

import { LyftaError } from './LyftaError';
import type { LyftaClient } from './LyftaClient';
import { LB_TO_KG } from './parseWorkouts';
import { createLyftaSyncRunner, incrementalWindow, LYFTA_PAGE_SIZE, syncLyfta } from './lyftaSync';

const sandbox = require('@/data/lyfta/__fixtures__/sandbox-workouts.json');

const NOW = new Date('2026-11-12T10:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

interface Call {
  page: number;
  limit: number;
  from?: string;
  to?: string;
}

/** Raw Lyfta workout `id`, performed `daysAgo` days before NOW. */
function rawWorkout(id: number, daysAgo: number) {
  const workout = structuredClone(sandbox.workouts[0]);
  workout.id = id;
  workout.workout_perform_date = new Date(NOW.getTime() - daysAgo * DAY_MS).toISOString();
  return workout;
}

/** Fake Lyfta server: serves `workouts` in pages, honouring from/to (YYYY-MM-DD, UTC days). */
function createFakeClient(initial: unknown[]) {
  const state = {
    workouts: initial as { id: number | string; workout_perform_date: string }[],
    calls: [] as Call[],
    failure: null as ((call: Call) => Error | null) | null,
    progress: { weight_unit: 'kg' } as unknown,
    progressCalls: 0,
    /** Which calendar day the server filters `from`/`to` on; defaults to the UTC day. */
    dayOf: ((iso: string) => iso.slice(0, 10)) as (iso: string) => string,
  };
  const client: LyftaClient = {
    async listWorkouts(call) {
      state.calls.push(call);
      const error = state.failure?.(call) ?? null;
      if (error) throw error;
      const matching = state.workouts.filter((w) => {
        const day = state.dayOf(w.workout_perform_date ?? '');
        return (
          (call.from === undefined || day >= call.from) && (call.to === undefined || day <= call.to)
        );
      });
      matching.sort((a, b) => b.workout_perform_date.localeCompare(a.workout_perform_date));
      const start = (call.page - 1) * call.limit;
      return {
        ...sandbox,
        workouts: matching.slice(start, start + call.limit),
        current_page: call.page,
        total_pages: Math.max(1, Math.ceil(matching.length / call.limit)),
      };
    },
    listSchedule: async () => ({}),
    getProfile: async () => ({}),
    getExerciseProgress: async () => {
      state.progressCalls += 1;
      return state.progress;
    },
  };
  return { client, state };
}

function manyWorkouts(n: number) {
  return Array.from({ length: n }, (_, i) => rawWorkout(i + 1, 30 + i * 0.01));
}

async function setup(initial: unknown[], withKey = true, unit: string | null = 'kg') {
  const db = await openTestDatabase();
  const workouts = createSqliteWorkoutRepository(db);
  const syncState = createSqliteSyncStateRepository(db);
  const settings = createSqliteSettingsRepository(db);
  const secrets = new InMemorySecretStore();
  if (withKey) await secrets.set(SECRET_KEYS.lyftaApiKey, 'test-key');
  if (unit !== null) await settings.set('lyfta.weightUnit', unit);
  const fake = createFakeClient(initial);
  const deps = { client: fake.client, workouts, syncState, settings, secrets, now: () => NOW };
  return { deps, workouts, syncState, settings, ...fake };
}

test('incrementalWindow pads 8 days back and 1 day forward in UTC', () => {
  expect(
    incrementalWindow(new Date('2026-11-12T10:00:00Z'), new Date('2026-11-13T09:00:00Z')),
  ).toEqual({
    from: '2026-11-04',
    to: '2026-11-14',
  });
});

test('returns not_configured without a key and calls nothing', async () => {
  const { deps, state } = await setup(manyWorkouts(3), false);
  expect(await syncLyfta(deps)).toEqual({ status: 'not_configured' });
  expect(state.calls).toEqual([]);
});

test('backfills every page, then clears the cursor and records success', async () => {
  const { deps, state, workouts, syncState } = await setup(manyWorkouts(250));
  const result = await syncLyfta(deps);
  expect(result).toEqual({
    status: 'ok',
    mode: 'backfill',
    inserted: 250,
    updated: 0,
    deleted: 0,
    skipped: 0,
  });
  expect(state.calls).toEqual([1, 2, 3].map((page) => ({ page, limit: LYFTA_PAGE_SIZE })));
  expect(await workouts.count()).toBe(250);
  expect(await syncState.get('lyfta')).toMatchObject({
    cursor: null,
    lastSuccessAt: NOW.toISOString(),
    lastError: null,
  });
});

test('resumes backfill from saved cursor', async () => {
  const { deps, state, workouts, syncState } = await setup(manyWorkouts(250));
  state.failure = (call) => (call.page === 2 ? new LyftaError('network', 'offline') : null);

  const first = await syncLyfta(deps);
  expect(first).toEqual({ status: 'error', message: 'offline' });
  expect(JSON.parse((await syncState.get('lyfta')).cursor as string)).toEqual({
    page: 2,
    startedAt: NOW.toISOString(),
  });
  expect(await workouts.count()).toBe(100);

  state.failure = null;
  state.calls.length = 0;
  const second = await syncLyfta(deps);
  expect(second).toMatchObject({ status: 'ok', mode: 'backfill', inserted: 150 });
  expect(state.calls.map((c) => c.page)).toEqual([2, 3]);
  expect(await workouts.count()).toBe(250);
});

test('runs incrementally after a successful backfill using the window', async () => {
  const { deps, state } = await setup(manyWorkouts(3));
  await syncLyfta(deps);
  state.calls.length = 0;

  const later = new Date(NOW.getTime() + 2 * DAY_MS);
  const result = await syncLyfta({ ...deps, now: () => later });
  const window = incrementalWindow(NOW, later);
  expect(result).toMatchObject({ status: 'ok', mode: 'incremental', inserted: 0, updated: 0 });
  expect(state.calls).toEqual([{ page: 1, limit: LYFTA_PAGE_SIZE, ...window }]);
});

test('deletes workouts removed in Lyfta within window', async () => {
  const recent = rawWorkout(1, 1);
  const old = rawWorkout(2, 60);
  const { deps, state, workouts } = await setup([recent, old]);
  await syncLyfta(deps);
  expect(await workouts.count()).toBe(2);

  state.workouts = [old]; // recent was deleted in Lyfta; old is outside the window
  const result = await syncLyfta(deps);
  expect(result).toMatchObject({ status: 'ok', mode: 'incremental', deleted: 1 });
  expect(await workouts.get(1)).toBeNull();
  expect(await workouts.get(2)).not.toBeNull();
});

test('does not delete anything when an incremental page fails', async () => {
  const { deps, state, workouts } = await setup([rawWorkout(1, 1), rawWorkout(2, 2)]);
  await syncLyfta(deps);

  state.workouts = [];
  state.failure = () => new LyftaError('server', 'Lyfta server error');
  const result = await syncLyfta(deps);
  expect(result).toEqual({ status: 'error', message: 'Lyfta server error' });
  expect(await workouts.count()).toBe(2);
});

test('returns invalid_key and keeps data on 401', async () => {
  const { deps, state, workouts, syncState } = await setup([rawWorkout(1, 1)]);
  await syncLyfta(deps);

  state.failure = () => new LyftaError('unauthorized', 'Lyfta rejected the API key', 401);
  expect(await syncLyfta(deps)).toEqual({ status: 'invalid_key' });
  expect((await syncState.get('lyfta')).lastError).toBe('invalid_key');
  expect(await workouts.count()).toBe(1);
});

test('reports skipped workouts from the parser', async () => {
  const bad = { id: 'not-a-number' };
  const { deps } = await setup([rawWorkout(1, 1), bad]);
  expect(await syncLyfta(deps)).toMatchObject({ status: 'ok', inserted: 1, skipped: 1 });
});

test('applies the lb conversion when the setting is lb', async () => {
  const kg = await setup([rawWorkout(1, 1)]);
  await syncLyfta(kg.deps);
  const kgWeight = (await kg.workouts.get(1))?.exercises[0].sets[0].weightKg;

  const lb = await setup([rawWorkout(1, 1)], true, 'lb');
  await syncLyfta(lb.deps);
  const lbWeight = (await lb.workouts.get(1))?.exercises[0].sets[0].weightKg;

  expect(kgWeight).toBeGreaterThan(0);
  expect(lbWeight).toBeCloseTo((kgWeight as number) * LB_TO_KG, 6);
  expect(lb.state.progressCalls).toBe(0);
});

test('reads an unset unit from exercise progress, persists lb and converts', async () => {
  const kg = await setup([rawWorkout(1, 1)]);
  await syncLyfta(kg.deps);
  const kgWeight = (await kg.workouts.get(1))?.exercises[0].sets[0].weightKg;

  const t = await setup([rawWorkout(1, 1)], true, null);
  t.state.progress = { weight_unit: 'LBS' };
  expect(await syncLyfta(t.deps)).toMatchObject({ status: 'ok' });
  expect(await t.settings.get('lyfta.weightUnit')).toBe('lb');
  expect((await t.workouts.get(1))?.exercises[0].sets[0].weightKg).toBeCloseTo(
    (kgWeight as number) * LB_TO_KG,
    6,
  );
});

test('reads kg from exercise progress and persists it', async () => {
  const t = await setup([rawWorkout(1, 1)], true, null);
  t.state.progress = { weight_unit: 'kgs' };
  expect(await syncLyfta(t.deps)).toMatchObject({ status: 'ok' });
  expect(await t.settings.get('lyfta.weightUnit')).toBe('kg');
});

test.each([[{ weight_unit: 'stone' }], [{ weight_unit: null }], [{}], ['nonsense']])(
  'refuses to sync when the unit from exercise progress is %j',
  async (progress) => {
    const t = await setup([rawWorkout(1, 1)], true, null);
    t.state.progress = progress;
    expect(await syncLyfta(t.deps)).toEqual({
      status: 'error',
      message: 'Could not determine the Lyfta weight unit',
    });
    expect(await t.settings.get('lyfta.weightUnit')).toBeNull();
    expect(await t.workouts.count()).toBe(0);
    expect(t.state.calls).toEqual([]);
    expect((await t.syncState.get('lyfta')).lastError).toBe(
      'Could not determine the Lyfta weight unit',
    );
  },
);

test('concurrent runs share one sync', async () => {
  const { deps, state } = await setup(manyWorkouts(3));
  const runner = createLyftaSyncRunner(deps);
  const [a, b] = await Promise.all([runner.run(), runner.run()]);
  expect(a).toEqual(b);
  expect(state.calls.filter((c) => c.page === 1)).toHaveLength(1);

  await runner.run(); // settled, so a new sync starts
  expect(state.calls.filter((c) => c.page === 1)).toHaveLength(2);
});

test('keeps stored workouts that now fail validation instead of deleting them', async () => {
  const { deps, state, workouts } = await setup([rawWorkout(1, 1), rawWorkout(2, 2)]);
  await syncLyfta(deps);

  // Same day (so the fake server still returns it) but an impossible time, so it fails parsing.
  const sameDay = state.workouts[0].workout_perform_date.slice(0, 10);
  const broken = { id: 1, workout_perform_date: `${sameDay} 25:99:00` };
  state.workouts = [broken, rawWorkout(2, 2)];
  expect(await syncLyfta(deps)).toMatchObject({
    status: 'ok',
    mode: 'incremental',
    deleted: 0,
    skipped: 1,
  });
  expect(await workouts.get(1)).not.toBeNull();
});

test('resolves with an error, without the key, when the secret store fails', async () => {
  const { deps } = await setup([]);
  const secrets: SecretStore = {
    get: () => Promise.reject(new Error('keychain unavailable')),
    set: async () => {},
    delete: async () => {},
  };
  const result = await syncLyfta({ ...deps, secrets });
  expect(result).toEqual({ status: 'error', message: 'keychain unavailable' });
  expect(JSON.stringify(result)).not.toContain('test-key');
});

test('still resolves when recording the error also fails', async () => {
  const { deps, state } = await setup([rawWorkout(1, 1)]);
  state.failure = () => new LyftaError('network', 'offline');
  const syncState = { ...deps.syncState, recordError: () => Promise.reject(new Error('db down')) };
  await expect(syncLyfta({ ...deps, syncState })).resolves.toEqual({
    status: 'error',
    message: 'offline',
  });
});

describe('incremental deletion safety', () => {
  const EDGE_NOW = new Date('2026-11-12T23:00:00.000Z');

  test('keeps a workout whose date moved earlier in Lyfta, with its new date', async () => {
    const t = await setup([rawWorkout(1, 1)]);
    await syncLyfta(t.deps);

    const moved = rawWorkout(1, 40);
    t.state.workouts = [moved];
    const result = await syncLyfta({ ...t.deps, now: () => new Date(NOW.getTime() + DAY_MS) });
    expect(result).toMatchObject({ status: 'ok', mode: 'incremental', deleted: 0, updated: 1 });
    expect((await t.workouts.get(1))?.performedAt).toBe(moved.workout_perform_date);
    expect(await t.workouts.count()).toBe(1);
  });

  test('still deletes a workout that no longer exists anywhere in Lyfta', async () => {
    const t = await setup([rawWorkout(1, 1), rawWorkout(2, 60)]);
    await syncLyfta(t.deps);

    t.state.workouts = [rawWorkout(2, 60)];
    t.state.calls.length = 0;
    const result = await syncLyfta(t.deps);
    expect(result).toMatchObject({ status: 'ok', deleted: 1 });
    expect(await t.workouts.get(1)).toBeNull();
    // Confirmation request: the unwindowed listing.
    expect(t.state.calls.some((c) => c.from === undefined && c.to === undefined)).toBe(true);
  });

  test('makes no confirmation request when nothing is missing', async () => {
    const t = await setup([rawWorkout(1, 1), rawWorkout(2, 2)]);
    await syncLyfta(t.deps);
    t.state.calls.length = 0;
    expect(await syncLyfta(t.deps)).toMatchObject({ status: 'ok', deleted: 0 });
    expect(t.state.calls).toHaveLength(1);
    expect(t.state.calls[0].from).toBeDefined();
  });

  test('deletes nothing and stays ok when the confirmation listing fails', async () => {
    const t = await setup([rawWorkout(1, 1)]);
    await syncLyfta(t.deps);

    t.state.workouts = [];
    t.state.failure = (call) =>
      call.from === undefined ? new LyftaError('network', 'offline') : null;
    expect(await syncLyfta(t.deps)).toMatchObject({
      status: 'ok',
      mode: 'incremental',
      deleted: 0,
    });
    expect(await t.workouts.count()).toBe(1);
    expect((await t.syncState.get('lyfta')).lastError).toBeNull();
  });

  test('deletes nothing when the confirmation listing skips a workout', async () => {
    const t = await setup([rawWorkout(1, 1)]);
    await syncLyfta(t.deps);

    t.state.workouts = [
      { id: 'not-a-number', workout_perform_date: rawWorkout(9, 90).workout_perform_date },
    ];
    expect(await syncLyfta(t.deps)).toMatchObject({ status: 'ok', deleted: 0, skipped: 0 });
    expect(await t.workouts.count()).toBe(1);
  });

  test('keeps an evening workout when the server filters from by local (UTC-5) day', async () => {
    const t = await setup([]);
    t.state.dayOf = (iso) =>
      new Date(new Date(iso).getTime() - 5 * 3600000).toISOString().slice(0, 10);
    // Nov 3, 8pm New York; the incremental window's `from` will be 2026-11-04.
    t.state.workouts = [{ ...rawWorkout(1, 0), workout_perform_date: '2026-11-04T01:00:00.000Z' }];
    await syncLyfta({ ...t.deps, now: () => EDGE_NOW });

    const result = await syncLyfta({ ...t.deps, now: () => new Date(EDGE_NOW.getTime() + 60000) });
    expect(result).toMatchObject({ status: 'ok', mode: 'incremental', deleted: 0 });
    expect(await t.workouts.get(1)).not.toBeNull();
  });
});

describe('backfill resume and paging', () => {
  test('a resumed backfill covers workouts logged during a long pause', async () => {
    const t = await setup([]);
    const t0 = new Date('2026-11-12T23:00:00.000Z');
    t.state.workouts = Array.from({ length: 150 }, (_, i) => ({
      ...rawWorkout(i + 1, 0),
      workout_perform_date: new Date(t0.getTime() - (30 + i) * DAY_MS).toISOString(),
    }));
    t.state.failure = (call) => (call.page === 2 ? new LyftaError('network', 'offline') : null);
    await syncLyfta({ ...t.deps, now: () => t0 });

    t.state.failure = null;
    for (let k = 0; k < 5; k += 1) {
      t.state.workouts.push({
        ...rawWorkout(1000 + k, 0),
        workout_perform_date: new Date(t0.getTime() + (1 + k) * DAY_MS).toISOString(),
      });
    }
    const resumeAt = new Date(t0.getTime() + 12 * DAY_MS);
    await syncLyfta({ ...t.deps, now: () => resumeAt });
    expect((await t.syncState.get('lyfta')).lastSuccessAt).toBe(t0.toISOString());

    await syncLyfta({ ...t.deps, now: () => new Date(resumeAt.getTime() + DAY_MS) });
    expect(await t.workouts.count()).toBe(155);
  });

  test('accepts a legacy plain page-number cursor and uses the current time', async () => {
    const t = await setup(manyWorkouts(250));
    await t.syncState.saveCursor('lyfta', '2');
    t.state.calls.length = 0;
    expect(await syncLyfta(t.deps)).toMatchObject({
      status: 'ok',
      mode: 'backfill',
      inserted: 150,
    });
    expect(t.state.calls.map((c) => c.page)).toEqual([2, 3]);
    expect((await t.syncState.get('lyfta')).lastSuccessAt).toBe(NOW.toISOString());
  });

  test('keeps paging past a page where every workout is skipped', async () => {
    const t = await setup([]);
    const bad = Array.from({ length: LYFTA_PAGE_SIZE }, (_, i) => ({
      id: `bad-${i}`,
      workout_perform_date: new Date(NOW.getTime() - (10 + i * 0.01) * DAY_MS).toISOString(),
    }));
    const good = Array.from({ length: 5 }, (_, i) => rawWorkout(i + 1, 200 + i));
    t.state.workouts = [...bad, ...good];
    const result = await syncLyfta(t.deps);
    expect(result).toMatchObject({
      status: 'ok',
      mode: 'backfill',
      inserted: 5,
      skipped: LYFTA_PAGE_SIZE,
    });
    expect(t.state.calls.map((c) => c.page)).toEqual([1, 2]);
  });
});
