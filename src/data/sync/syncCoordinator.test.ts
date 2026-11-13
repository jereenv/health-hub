import type { LyftaClient } from '@/data/lyfta/LyftaClient';
import { LyftaError } from '@/data/lyfta/LyftaError';
import { LB_TO_KG, WORKOUT_PARSER_VERSION } from '@/data/lyfta/parseWorkouts';
import { wipeSyncedData } from '@/data/maintenance/wipeSyncedData';
import { createSqliteProfileRepository } from '@/data/profile/ProfileRepository';
import { createSqliteScheduleRepository } from '@/data/schedule/ScheduleRepository';
import { SECRET_KEYS, type SecretStore } from '@/data/secrets/SecretStore';
import { createPreferencesStore } from '@/data/settings/preferences';
import { createSqliteSettingsRepository } from '@/data/settings/SettingsRepository';
import { createSqliteWorkoutRepository } from '@/data/workouts/sqliteWorkoutRepository';
import { InMemorySecretStore } from '@/test-support/InMemorySecretStore';
import { openTestDatabase } from '@/test-support/sqljsDatabase';

import { createSyncCoordinator } from './syncCoordinator';
import { createSqliteSyncStateRepository } from './SyncStateRepository';

const sandbox = require('@/data/lyfta/__fixtures__/sandbox-workouts.json');
const scheduleFixture = require('@/data/lyfta/__fixtures__/schedule-page.json');

const NOW = new Date('2026-11-12T10:00:00.000Z');

interface Deferred {
  promise: Promise<void>;
  release(): void;
}

/** Lets every already-queued promise callback and zero-delay timer run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function deferred(): Deferred {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function setup(options: { withKey?: boolean; unit?: string | null } = {}) {
  const { withKey = true, unit = 'kg' } = options;
  const db = await openTestDatabase();
  const workouts = createSqliteWorkoutRepository(db);
  const schedule = createSqliteScheduleRepository(db);
  const syncState = createSqliteSyncStateRepository(db);
  const settings = createSqliteSettingsRepository(db);
  const profile = createSqliteProfileRepository(db);
  const secrets = new InMemorySecretStore();
  if (withKey) await secrets.set(SECRET_KEYS.lyftaApiKey, 'test-key');
  if (unit !== null) await settings.set('lyfta.weightUnit', unit);
  const preferences = await createPreferencesStore(settings);

  const log: string[] = [];
  const workoutPages: Record<string, unknown>[] = [];
  const state = {
    progress: { weight_unit: 'kg' } as unknown,
    progressError: null as Error | null,
    /** Blocks `listWorkouts` until released. */
    gate: null as Deferred | null,
    workoutsError: null as Error | null,
    scheduleError: null as Error | null,
  };
  const client: LyftaClient = {
    async listWorkouts(call) {
      log.push('listWorkouts');
      workoutPages.push(call);
      await state.gate?.promise;
      if (state.workoutsError) throw state.workoutsError;
      return sandbox;
    },
    async listSchedule() {
      log.push('listSchedule');
      if (state.scheduleError) throw state.scheduleError;
      return scheduleFixture;
    },
    getProfile: async () => ({}),
    async getExerciseProgress() {
      log.push('getExerciseProgress');
      if (state.progressError) throw state.progressError;
      return state.progress;
    },
  };

  const deps = {
    client,
    workouts,
    schedule,
    syncState,
    settings,
    secrets,
    preferences,
    wipeSyncedData: () => wipeSyncedData(db),
    now: () => NOW,
  };
  const sync = createSyncCoordinator(deps);
  return { sync, deps, db, log, workoutPages, state, profile };
}

test('runs re-parse, unit check, workouts and schedule in that order', async () => {
  const { sync, log } = await setup();
  const result = await sync.run();
  expect(log).toEqual(['getExerciseProgress', 'listWorkouts', 'listSchedule']);
  expect(result.workouts).toMatchObject({ status: 'ok', mode: 'backfill' });
  expect(result.schedule).toMatchObject({ status: 'ok' });
});

test('makes no request without a key', async () => {
  const { sync, log } = await setup({ withKey: false });
  expect(await sync.run()).toEqual({
    workouts: { status: 'not_configured' },
    schedule: { status: 'skipped' },
    reparsed: null,
  });
  expect(log).toEqual([]);
});

test('stops with invalid_key when the unit check is rejected', async () => {
  const { sync, log, state, deps } = await setup();
  state.progressError = new LyftaError('unauthorized', 'nope');
  const result = await sync.run();
  expect(result.workouts).toEqual({ status: 'invalid_key' });
  expect(result.schedule).toEqual({ status: 'skipped' });
  expect(log).toEqual(['getExerciseProgress']);
  expect((await deps.syncState.get('lyfta')).lastError).toBe('invalid_key');
});

test('ignores another unit check failure and lets the sync report on its own', async () => {
  const { sync, log, state } = await setup();
  state.progressError = new LyftaError('network', 'offline');
  const result = await sync.run();
  expect(result.workouts).toMatchObject({ status: 'ok' });
  expect(log).toEqual(['getExerciseProgress', 'listWorkouts', 'listSchedule']);
});

describe('a Lyfta unit change downloads the history again', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const lyftaLocal = (ms: number): string => {
    const d = new Date(ms);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:00:00`;
  };

  /**
   * A fake account holding two workouts of one 100 kg set: one 60 days old (outside the 8-day
   * window) and one from yesterday. A converting server stores kg and shows the account unit; a
   * re-labelling server shows the same number whatever the unit is.
   */
  async function setupUnitServer(model: 'converting' | 'relabelling') {
    const base = await setup({ unit: null });
    const server = { unit: 'lb' as 'kg' | 'lb' };
    const shown = (): number =>
      model === 'converting' && server.unit === 'lb' ? 100 / LB_TO_KG : 100;
    const calls: { from?: string; to?: string }[] = [];
    const client: LyftaClient = {
      ...base.deps.client,
      async listWorkouts({ page, limit, from, to }) {
        calls.push({ from, to });
        const all = [
          { id: 1, daysAgo: 60 },
          { id: 2, daysAgo: 1 },
        ].filter(({ daysAgo }) => {
          const day = new Date(NOW.getTime() - daysAgo * DAY_MS).toISOString().slice(0, 10);
          return (from === undefined || day >= from) && (to === undefined || day <= to);
        });
        const slice = all.slice((page - 1) * limit, page * limit);
        return {
          workouts: slice.map(({ id, daysAgo }) => ({
            id,
            title: 'Session',
            workout_perform_date: lyftaLocal(NOW.getTime() - daysAgo * DAY_MS),
            weight_unit: null,
            exercises: [
              {
                exercise_id: 7,
                excercise_name: 'Bench',
                exercise_type: 'weight_reps',
                sets: [{ weight: String(shown()), reps: '5', is_completed: true }],
              },
            ],
          })),
          current_page: page,
          total_pages: Math.max(1, Math.ceil(all.length / limit)),
          total_records: all.length,
        };
      },
      getExerciseProgress: async () => ({ weight_unit: server.unit }),
    };
    const sync = createSyncCoordinator({ ...base.deps, client });
    const firstSetKg = async (id: number) =>
      (await base.deps.workouts.get(id))?.exercises[0]?.sets[0]?.weightKg ?? null;
    return { sync, server, calls, firstSetKg, deps: base.deps };
  }

  test('a converting server: an old 100 kg set stays 100 kg after lb to kg', async () => {
    const t = await setupUnitServer('converting');
    await t.sync.run();
    expect(await t.firstSetKg(1)).toBeCloseTo(100, 6);

    t.server.unit = 'kg';
    const result = await t.sync.run();
    expect(result.workouts).toMatchObject({ status: 'ok', mode: 'backfill' });
    expect(await t.firstSetKg(1)).toBeCloseTo(100, 6);
    expect(await t.firstSetKg(2)).toBeCloseTo(100, 6);
  });

  test('a re-labelling server: the old workout shows what the server now reports', async () => {
    const t = await setupUnitServer('relabelling');
    await t.sync.run();
    expect(await t.firstSetKg(1)).toBeCloseTo(100 * LB_TO_KG, 6);

    t.server.unit = 'kg';
    await t.sync.run();
    expect(await t.firstSetKg(1)).toBeCloseTo(100, 6);
    expect(await t.firstSetKg(2)).toBeCloseTo(100, 6);
  });

  test('lists without from/to, saves parsedWith for the new unit and re-parses nothing', async () => {
    const t = await setupUnitServer('converting');
    await t.sync.run();
    t.calls.length = 0;

    t.server.unit = 'kg';
    const result = await t.sync.run();
    expect(t.calls.length).toBeGreaterThan(0);
    for (const call of t.calls) {
      expect(call.from).toBeUndefined();
      expect(call.to).toBeUndefined();
    }
    expect(result.reparsed).toBeNull();
    expect(JSON.parse((await t.deps.settings.get('lyfta.parsedWith')) ?? 'null')).toEqual({
      version: WORKOUT_PARSER_VERSION,
      unit: 'kg',
      skipped: 0,
    });
    expect(await t.deps.settings.get('lyfta.weightUnit')).toBe('kg');
  });
});

test('saves parsedWith after the first backfill, so the next run re-parses nothing', async () => {
  const { sync, deps } = await setup({ unit: null });
  // First run: the unit is only detected during the sync, after the first re-parse step.
  const first = await sync.run();
  expect(first.workouts).toMatchObject({ status: 'ok', mode: 'backfill' });
  expect(first.reparsed).toEqual({ reparsed: 2, skipped: 0 });
  expect(await deps.settings.get('lyfta.parsedWith')).not.toBeNull();

  expect((await sync.run()).reparsed).toBeNull();
});

test('refreshes preferences after a run', async () => {
  const { sync, deps } = await setup({ unit: null });
  expect(deps.preferences.getSnapshot().lyftaAccountUnit).toBeNull();
  await sync.run();
  expect(deps.preferences.getSnapshot().lyftaAccountUnit).toBe('kg');
});

test('concurrent runs share one sync', async () => {
  const { sync, workoutPages } = await setup();
  const [a, b] = await Promise.all([sync.run(), sync.run()]);
  expect(a).toBe(b);
  expect(workoutPages.filter((c) => c.page === 1)).toHaveLength(1);

  await sync.run(); // settled, so a new sync starts
  expect(workoutPages.filter((c) => c.page === 1)).toHaveLength(2);
});

test('run while a resync is in flight returns the resync result', async () => {
  const { sync, state, workoutPages } = await setup();
  state.gate = deferred();
  const resync = sync.resync();
  const run = sync.run();
  state.gate.release();
  expect(await run).toBe(await resync);
  expect(workoutPages).toHaveLength(1);
});

test('resync clears both sync states and backfills', async () => {
  const { sync, deps, log, workoutPages, state } = await setup();
  await sync.run();
  expect((await deps.syncState.get('lyfta')).lastSuccessAt).not.toBeNull();
  expect((await deps.syncState.get('lyfta_schedule')).lastSuccessAt).not.toBeNull();
  log.length = 0;
  workoutPages.length = 0;

  // A failing schedule sync keeps the last success it has, so null proves resync reset it.
  state.scheduleError = new LyftaError('network', 'offline');
  const result = await sync.resync();
  expect((await deps.syncState.get('lyfta_schedule')).lastSuccessAt).toBeNull();
  expect(result.schedule).toEqual({ status: 'error', message: 'offline' });
  expect(result.workouts).toMatchObject({ status: 'ok', mode: 'backfill' });
  expect(workoutPages[0]).not.toHaveProperty('from');
  expect(workoutPages[0]).not.toHaveProperty('to');
  expect(log).toContain('listSchedule');
});

test('resync waits for an in-flight run, then runs again', async () => {
  const { sync, state, workoutPages } = await setup();
  state.gate = deferred();
  const run = sync.run();
  const resync = sync.resync();
  await settle();
  expect(workoutPages).toHaveLength(1);
  state.gate.release();
  await Promise.all([run, resync]);
  expect(workoutPages).toHaveLength(2);
  expect(workoutPages[1]).not.toHaveProperty('from');
});

test('run waits for an in-flight wipe, then runs', async () => {
  const { deps, db, workoutPages } = await setup();
  const wipeGate = deferred();
  const slowWipe = async () => {
    await wipeGate.promise;
    await wipeSyncedData(db);
  };
  const coordinator = createSyncCoordinator({ ...deps, wipeSyncedData: slowWipe });
  const wipe = coordinator.wipe();
  const run = coordinator.run();
  await settle();
  expect(workoutPages).toHaveLength(0);
  wipeGate.release();
  await wipe;
  expect((await run).workouts).toMatchObject({ status: 'ok' });
  expect(workoutPages).toHaveLength(1);
});

test('wipe waits for an in-flight run, then leaves no synced data', async () => {
  const { sync, deps, state, profile } = await setup();
  await deps.settings.set('display.weightUnit', 'lb');
  await profile.save(
    { heightCm: 180, birthDate: null, sex: null, goalWeightKg: null, bmiCutoffs: 'who' },
    NOW.toISOString(),
  );
  state.gate = deferred();
  const run = sync.run();
  const wipe = sync.wipe();
  await settle();
  state.gate.release();
  await Promise.all([run, wipe]);

  expect(await deps.workouts.count()).toBe(0);
  expect(await deps.schedule.count()).toBe(0);
  expect((await deps.syncState.get('lyfta')).lastSuccessAt).toBeNull();
  expect((await deps.syncState.get('lyfta_schedule')).lastSuccessAt).toBeNull();
  expect(await deps.secrets.get(SECRET_KEYS.lyftaApiKey)).toBe('test-key');
  expect(await deps.settings.get('display.weightUnit')).toBe('lb');
  expect((await profile.getCurrent())?.heightCm).toBe(180);
});

test('wipe waits for an in-flight resync as well', async () => {
  const { sync, deps, state } = await setup();
  state.gate = deferred();
  const resync = sync.resync();
  const wipe = sync.wipe();
  state.gate.release();
  await Promise.all([resync, wipe]);
  expect(await deps.workouts.count()).toBe(0);
});

test('snapshot is stable between changes and bumps dataVersion after each run and wipe', async () => {
  const { sync, state } = await setup();
  const initial = sync.getSnapshot();
  expect(initial).toEqual({ running: false, lastResult: null, dataVersion: 0 });
  expect(sync.getSnapshot()).toBe(initial);

  const seen: boolean[] = [];
  const unsubscribe = sync.subscribe(() => seen.push(sync.getSnapshot().running));
  state.gate = deferred();
  const run = sync.run();
  await settle();
  const during = sync.getSnapshot();
  expect(during.running).toBe(true);
  expect(sync.getSnapshot()).toBe(during);

  state.gate.release();
  const result = await run;
  const after = sync.getSnapshot();
  expect(after).toEqual({ running: false, lastResult: result, dataVersion: 1 });
  expect(seen).toEqual([true, false]);

  await sync.wipe();
  expect(sync.getSnapshot()).toEqual({ running: false, lastResult: result, dataVersion: 2 });
  expect(seen).toEqual([true, false, false]);

  unsubscribe();
  await sync.run();
  expect(seen).toHaveLength(3);
});

describe('a failing re-parse is not fatal', () => {
  const failingRaw = (deps: Awaited<ReturnType<typeof setup>>['deps']) => {
    const listRaw = jest.fn(() => Promise.reject(new Error('db down')));
    return { workouts: { ...deps.workouts, listRaw }, listRaw };
  };

  test('before the sync: workouts and schedule still sync normally', async () => {
    const { deps, log } = await setup();
    const failing = failingRaw(deps);
    const sync = createSyncCoordinator({ ...deps, workouts: failing.workouts });
    const result = await sync.run();
    // Thrown once before the sync and once after it; neither changed the results.
    expect(failing.listRaw).toHaveBeenCalledTimes(2);
    expect(result.workouts).toMatchObject({ status: 'ok' });
    expect(result.schedule).toMatchObject({ status: 'ok' });
    expect(result.reparsed).toBeNull();
    expect(log).toEqual(['getExerciseProgress', 'listWorkouts', 'listSchedule']);
    expect(await deps.settings.get('lyfta.parsedWith')).toBeNull();
  });

  test('after a successful sync: workouts stay ok', async () => {
    const { deps } = await setup({ unit: null });
    const failing = failingRaw(deps);
    const sync = createSyncCoordinator({ ...deps, workouts: failing.workouts });
    const result = await sync.run();
    // No unit yet, so the first re-parse returns early; only the one after the sync reads raw rows.
    expect(failing.listRaw).toHaveBeenCalledTimes(1);
    expect(result.workouts).toMatchObject({ status: 'ok', mode: 'backfill' });
    expect(result.reparsed).toBeNull();
  });
});

describe('never rejects', () => {
  test('when a listener throws, and the other listeners are still called', async () => {
    const { sync } = await setup();
    const good = jest.fn();
    sync.subscribe(() => {
      throw new Error('bad listener');
    });
    sync.subscribe(good);
    await expect(sync.run()).resolves.toMatchObject({ workouts: { status: 'ok' } });
    expect(good).toHaveBeenCalledTimes(2);
    await expect(sync.wipe()).resolves.toBeUndefined();
    expect(good).toHaveBeenCalledTimes(3);
  });

  test('when the secret store throws: later steps still run', async () => {
    const { deps, log } = await setup();
    const secrets: SecretStore = {
      get: () => Promise.reject(new Error('keychain')),
      set: async () => {},
      delete: async () => {},
    };
    const reload = jest.fn(async () => {});
    const sync = createSyncCoordinator({ ...deps, secrets, preferences: { reload } });
    const result = await sync.run();
    expect(result.workouts).toEqual({ status: 'error', message: 'keychain' });
    expect(result.schedule).toMatchObject({ status: 'ok' });
    expect(log).toEqual(['listSchedule']);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain('test-key');
  });

  test('and still runs the schedule after a workouts error', async () => {
    const { sync, state, log } = await setup();
    state.workoutsError = new LyftaError('network', 'offline');
    const result = await sync.run();
    expect(result.workouts).toEqual({ status: 'error', message: 'offline' });
    expect(result.schedule).toMatchObject({ status: 'ok' });
    expect(log).toContain('listSchedule');
  });

  test('when preferences.reload throws', async () => {
    const { deps } = await setup();
    const preferences = { reload: () => Promise.reject(new Error('reload failed')) };
    const sync = createSyncCoordinator({ ...deps, preferences });
    expect((await sync.run()).workouts).toMatchObject({ status: 'ok' });
  });

  test('when resync cannot reset the sync state', async () => {
    const { deps } = await setup();
    const syncState = { ...deps.syncState, reset: () => Promise.reject(new Error('reset failed')) };
    const sync = createSyncCoordinator({ ...deps, syncState });
    expect((await sync.resync()).workouts).toEqual({ status: 'error', message: 'reset failed' });
  });

  test('when the wipe fails: data is unchanged and subscribers are still told', async () => {
    const { deps, sync: ok } = await setup();
    await ok.run();
    const sync = createSyncCoordinator({
      ...deps,
      wipeSyncedData: () => Promise.reject(new Error('wipe failed')),
    });
    const listener = jest.fn();
    sync.subscribe(listener);
    await expect(sync.wipe()).resolves.toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(await deps.workouts.count()).toBe(2);
  });
});
