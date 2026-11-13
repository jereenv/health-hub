import type { LyftaClient } from '@/data/lyfta/LyftaClient';
import { LyftaError } from '@/data/lyfta/LyftaError';
import type { LyftaSyncResult } from '@/data/lyfta/lyftaSync';
import { syncLyfta } from '@/data/lyfta/lyftaSync';
import { refreshLyftaUnit } from '@/data/lyfta/lyftaUnit';
import type { ScheduleSyncResult } from '@/data/lyfta/scheduleSync';
import { syncLyftaSchedule } from '@/data/lyfta/scheduleSync';
import type { ScheduleRepository } from '@/data/schedule/ScheduleRepository';
import type { SecretStore } from '@/data/secrets/SecretStore';
import { SECRET_KEYS } from '@/data/secrets/SecretStore';
import type { PreferencesStore } from '@/data/settings/preferences';
import type { SettingsRepository } from '@/data/settings/SettingsRepository';
import { ensureWorkoutsParsed } from '@/data/workouts/reparseStoredWorkouts';
import type { WorkoutRepository } from '@/data/workouts/WorkoutRepository';

import type { SyncStateRepository } from './SyncStateRepository';

export interface SyncRunResult {
  workouts: LyftaSyncResult;
  schedule: ScheduleSyncResult | { status: 'skipped' };
  /** Stored workouts re-parsed during this run, summed over every re-parse; null if none did work. */
  reparsed: { reparsed: number; skipped: number } | null;
}

/** Shaped for React's `useSyncExternalStore`. */
export interface SyncSnapshot {
  running: boolean;
  lastResult: SyncRunResult | null;
  /** Bumped after every run, re-sync and wipe, so screens know to re-read stored data. */
  dataVersion: number;
}

export interface SyncCoordinatorDeps {
  client: LyftaClient;
  workouts: WorkoutRepository;
  schedule: ScheduleRepository;
  syncState: SyncStateRepository;
  settings: SettingsRepository;
  secrets: SecretStore;
  preferences: Pick<PreferencesStore, 'reload'>;
  wipeSyncedData: () => Promise<void>;
  /** Injected so tests control timestamps. */
  now: () => Date;
}

export interface SyncCoordinator {
  /** Syncs workouts and schedule. Shares the promise of a run or re-sync already in flight. */
  run(): Promise<SyncRunResult>;
  /** Forgets both sync positions, then runs: a full re-backfill that retries skipped workouts. */
  resync(): Promise<SyncRunResult>;
  /** Deletes all synced data (not the key, settings or profile). */
  wipe(): Promise<void>;
  subscribe(listener: () => void): () => void;
  getSnapshot(): SyncSnapshot;
}

const SKIPPED = { status: 'skipped' } as const;
const noop = (): void => {};

function messageOf(error: unknown): string {
  return error instanceof Error && error.message !== '' ? error.message : 'Sync failed';
}

/**
 * Owns everything that writes synced data. Re-parsing, workout sync, schedule sync, re-sync and
 * wipe all execute inside one slot, one at a time: the re-parse reads then writes in separate
 * transactions, so running it beside a sync could lose an update. Nothing else in the app may call
 * those functions directly. None of the public methods rejects.
 */
export function createSyncCoordinator(deps: SyncCoordinatorDeps): SyncCoordinator {
  const { client, workouts, schedule, syncState, settings, secrets } = deps;

  const listeners = new Set<() => void>();
  let snapshot: SyncSnapshot = { running: false, lastResult: null, dataVersion: 0 };
  /** The end of the queue of work for the slot; every task is appended here and never rejects. */
  let tail: Promise<unknown> = Promise.resolve();
  /** The newest run or re-sync that has not finished, queued or executing. */
  let activeRun: Promise<SyncRunResult> | null = null;

  function update(patch: Partial<SyncSnapshot>): void {
    snapshot = { ...snapshot, ...patch };
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        // One failing subscriber must not skip the others or make a sync call reject.
      }
    }
  }

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = tail.then(task);
    // Tasks are written never to reject, but if one ever did, chaining on the raw promise would
    // make every later task fail too. The tail swallows the outcome; callers still get `next`.
    tail = next.then(noop, noop);
    return next;
  }

  /**
   * Re-parses stored workouts and returns the counts. A failure is not fatal: the re-parse is local
   * bookkeeping that leaves `parsedWith` unsaved, so the next run retries it, and a real database
   * problem shows up in the sync's own result. It counts as no work.
   */
  async function reparse(): Promise<{ reparsed: number; skipped: number } | null> {
    try {
      return await ensureWorkoutsParsed({ workouts, settings });
    } catch {
      return null;
    }
  }

  async function execute(): Promise<SyncRunResult> {
    let reparsed: SyncRunResult['reparsed'] = null;
    const finish = (
      workoutsResult: LyftaSyncResult,
      scheduleResult: SyncRunResult['schedule'],
    ): SyncRunResult => ({ workouts: workoutsResult, schedule: scheduleResult, reparsed });

    /** Runs a re-parse and adds its counts, when it did any work, to `reparsed`. */
    const reparseAndRecord = async (): Promise<void> => {
      const counts = await reparse();
      if (counts === null || counts.reparsed + counts.skipped === 0) return;
      reparsed = {
        reparsed: (reparsed?.reparsed ?? 0) + counts.reparsed,
        skipped: (reparsed?.skipped ?? 0) + counts.skipped,
      };
    };

    // 1. Local only: bring stored workouts up to the current parser and unit.
    await reparseAndRecord();

    // 2. Without a key there is nothing to ask Lyfta.
    let workoutsResult: LyftaSyncResult | null = null;
    try {
      const apiKey = await secrets.get(SECRET_KEYS.lyftaApiKey);
      if (apiKey === null || apiKey === '') return finish({ status: 'not_configured' }, SKIPPED);
    } catch (error) {
      // No usable key, so no unit check or workouts sync; the later steps still follow their rules.
      workoutsResult = { status: 'error', message: messageOf(error) };
    }

    if (workoutsResult === null) {
      // 3. Re-check the account unit; a change means stored weights must be converted again.
      try {
        const { changed } = await refreshLyftaUnit({ client, settings });
        if (changed) await reparseAndRecord();
      } catch (error) {
        if (error instanceof LyftaError && error.kind === 'unauthorized') {
          try {
            await syncState.recordError('lyfta', 'invalid_key', deps.now().toISOString());
          } catch {
            // Bookkeeping failed; the result still tells the caller the key was rejected.
          }
          return finish({ status: 'invalid_key' }, SKIPPED);
        }
        // Any other failure is left for `syncLyfta`, which records and reports it itself.
      }

      // 4. Workouts.
      try {
        workoutsResult = await syncLyfta({
          client,
          workouts,
          syncState,
          settings,
          secrets,
          now: deps.now,
        });
      } catch (error) {
        workoutsResult = { status: 'error', message: messageOf(error) };
      }
    }

    // The first backfill detects the unit, so only now can it be parsed with and remembered.
    if (workoutsResult.status === 'ok') await reparseAndRecord();

    // 5. Schedule, unless the key is missing or rejected.
    let scheduleResult: SyncRunResult['schedule'] = SKIPPED;
    if (workoutsResult.status !== 'invalid_key' && workoutsResult.status !== 'not_configured') {
      try {
        scheduleResult = await syncLyftaSchedule({ client, schedule, syncState, now: deps.now });
      } catch (error) {
        scheduleResult = { status: 'error', message: messageOf(error) };
      }
    }

    // 6. The sync may have detected the Lyfta unit, which the display preference follows.
    try {
      await deps.preferences.reload();
    } catch {
      // Not a sync failure: the preference store keeps its previous snapshot.
    }

    return finish(workoutsResult, scheduleResult);
  }

  /** The slot body of a run or re-sync: flips `running`, executes, publishes the result. */
  async function runInSlot(beforeRun?: () => Promise<void>): Promise<SyncRunResult> {
    update({ running: true });
    let result: SyncRunResult;
    try {
      await beforeRun?.();
      result = await execute();
    } catch (error) {
      result = {
        workouts: { status: 'error', message: messageOf(error) },
        schedule: SKIPPED,
        reparsed: null,
      };
    }
    update({ running: false, lastResult: result, dataVersion: snapshot.dataVersion + 1 });
    return result;
  }

  function queueRun(beforeRun?: () => Promise<void>): Promise<SyncRunResult> {
    const promise: Promise<SyncRunResult> = enqueue(() => runInSlot(beforeRun)).finally(() => {
      if (activeRun === promise) activeRun = null;
    });
    activeRun = promise;
    return promise;
  }

  return {
    run() {
      return activeRun ?? queueRun();
    },

    resync() {
      return queueRun(async () => {
        await syncState.reset('lyfta');
        await syncState.reset('lyfta_schedule');
      });
    },

    wipe() {
      return enqueue(async () => {
        try {
          await deps.wipeSyncedData();
        } catch {
          // The transaction rolled back, so synced data is unchanged; callers still re-read.
        }
        update({ dataVersion: snapshot.dataVersion + 1 });
      });
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot: () => snapshot,
  };
}
