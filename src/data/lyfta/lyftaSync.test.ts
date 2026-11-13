import { createSqliteSettingsRepository } from '@/data/settings/SettingsRepository';
import { createSqliteSyncStateRepository } from '@/data/sync/SyncStateRepository';
import { createSqliteWorkoutRepository } from '@/data/workouts/sqliteWorkoutRepository';
import { SECRET_KEYS } from '@/data/secrets/SecretStore';
import { InMemorySecretStore } from '@/test-support/InMemorySecretStore';
import { openTestDatabase } from '@/test-support/sqljsDatabase';

import { LyftaError } from './LyftaError';
import type { LyftaClient } from './LyftaClient';
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
    workouts: initial as { id: number; workout_perform_date: string }[],
    calls: [] as Call[],
    failure: null as ((call: Call) => Error | null) | null,
  };
  const client: LyftaClient = {
    async listWorkouts(call) {
      state.calls.push(call);
      const error = state.failure?.(call) ?? null;
      if (error) throw error;
      const matching = state.workouts.filter((w) => {
        const day = (w.workout_perform_date ?? '').slice(0, 10);
        return (call.from === undefined || day >= call.from) && (call.to === undefined || day <= call.to);
      });
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
    getExerciseProgress: async () => ({}),
  };
  return { client, state };
}

function manyWorkouts(n: number) {
  return Array.from({ length: n }, (_, i) => rawWorkout(i + 1, 30 + i * 0.01));
}

async function setup(initial: unknown[], withKey = true) {
  const db = await openTestDatabase();
  const workouts = createSqliteWorkoutRepository(db);
  const syncState = createSqliteSyncStateRepository(db);
  const settings = createSqliteSettingsRepository(db);
  const secrets = new InMemorySecretStore();
  if (withKey) await secrets.set(SECRET_KEYS.lyftaApiKey, 'test-key');
  const fake = createFakeClient(initial);
  const deps = { client: fake.client, workouts, syncState, settings, secrets, now: () => NOW };
  return { deps, workouts, syncState, settings, ...fake };
}

test('incrementalWindow pads 8 days back and 1 day forward in UTC', () => {
  expect(incrementalWindow(new Date('2026-11-12T10:00:00Z'), new Date('2026-11-13T09:00:00Z'))).toEqual({
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
  expect(result).toEqual({ status: 'ok', mode: 'backfill', inserted: 250, updated: 0, deleted: 0, skipped: 0 });
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
  expect((await syncState.get('lyfta')).cursor).toBe('2');
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

test('uses the lyfta.weightUnit setting, defaulting to kg', async () => {
  const lb = await setup([rawWorkout(1, 1)]);
  await syncLyfta(lb.deps);
  const kgWeight = (await lb.workouts.get(1))?.exercises[0].sets[0].weightKg;

  const setting = await setup([rawWorkout(1, 1)]);
  await setting.settings.set('lyfta.weightUnit', 'lb');
  await syncLyfta(setting.deps);
  const lbWeight = (await setting.workouts.get(1))?.exercises[0].sets[0].weightKg;

  expect(kgWeight).toBeGreaterThan(0);
  expect(lbWeight).toBeCloseTo((kgWeight as number) * 0.45359237, 6);
});

test('concurrent runs share one sync', async () => {
  const { deps, state } = await setup(manyWorkouts(3));
  const runner = createLyftaSyncRunner(deps);
  const [a, b] = await Promise.all([runner.run(), runner.run()]);
  expect(a).toEqual(b);
  expect(state.calls.filter((c) => c.page === 1)).toHaveLength(1);

  await runner.run(); // settled, so a new sync starts
  expect(state.calls.filter((c) => c.page === 1)).toHaveLength(2);
});
