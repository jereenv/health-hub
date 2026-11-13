import type { SecretStore } from '@/data/secrets/SecretStore';
import { SECRET_KEYS } from '@/data/secrets/SecretStore';
import type { SettingsRepository } from '@/data/settings/SettingsRepository';
import type { SyncStateRepository } from '@/data/sync/SyncStateRepository';
import type { WorkoutRepository } from '@/data/workouts/WorkoutRepository';
import type { WeightUnit } from '@/domain/workouts/types';

import type { LyftaClient } from './LyftaClient';
import { LyftaError } from './LyftaError';
import { parseWorkoutPage } from './parseWorkouts';

/** Workouts requested per page; matches the largest page the Lyfta API serves. */
export const LYFTA_PAGE_SIZE = 100;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Re-read this many days before the last sync so edits to recent workouts are picked up. */
const WINDOW_DAYS_BACK = 8;
const WINDOW_DAYS_FORWARD = 1;
const FALLBACK_ERROR_MESSAGE = 'Lyfta sync failed';

export type LyftaSyncResult =
  | { status: 'not_configured' }
  | { status: 'invalid_key' }
  | {
      status: 'ok';
      mode: 'backfill' | 'incremental';
      inserted: number;
      updated: number;
      deleted: number;
      skipped: number;
    }
  | { status: 'error'; message: string };

export interface LyftaSyncDeps {
  client: LyftaClient;
  workouts: WorkoutRepository;
  syncState: SyncStateRepository;
  settings: SettingsRepository;
  secrets: SecretStore;
  /** Injected so tests control timestamps. */
  now: () => Date;
}

function utcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The UTC date range an incremental sync re-reads: 8 days before the last success (to catch edits)
 * through tomorrow (to tolerate clock and timezone skew).
 */
export function incrementalWindow(lastSuccessAt: Date, now: Date): { from: string; to: string } {
  return {
    from: utcDate(new Date(lastSuccessAt.getTime() - WINDOW_DAYS_BACK * DAY_MS)),
    to: utcDate(new Date(now.getTime() + WINDOW_DAYS_FORWARD * DAY_MS)),
  };
}

interface Totals {
  inserted: number;
  updated: number;
  skipped: number;
}

/**
 * Pulls Lyfta workouts into local storage. The first run backfills all history page by page and
 * saves a cursor after each page, so an interrupted run resumes where it stopped. Later runs
 * re-read a recent window to pick up edits and deletions. Never throws: failures are recorded in
 * the sync state and returned as a result.
 */
export async function syncLyfta(deps: LyftaSyncDeps): Promise<LyftaSyncResult> {
  const { client, workouts, syncState, settings, secrets } = deps;

  const apiKey = await secrets.get(SECRET_KEYS.lyftaApiKey);
  if (apiKey === null || apiKey === '') return { status: 'not_configured' };

  try {
    const unit: WeightUnit = (await settings.get('lyfta.weightUnit')) === 'lb' ? 'lb' : 'kg';
    const state = await syncState.get('lyfta');
    const totals: Totals = { inserted: 0, updated: 0, skipped: 0 };
    const syncedAt = deps.now().toISOString();

    /** Fetches pages starting at `startPage` until the last one, storing each via `onPage`. */
    const fetchPages = async (
      startPage: number,
      range: { from?: string; to?: string },
      onPage: (page: number, ids: number[]) => Promise<void>,
    ): Promise<number[]> => {
      const allIds: number[] = [];
      for (let page = startPage; ; page += 1) {
        const json = await client.listWorkouts({ page, limit: LYFTA_PAGE_SIZE, ...range });
        const parsed = parseWorkoutPage(json, unit);
        const result = await workouts.upsertMany(parsed.workouts, syncedAt);
        totals.inserted += result.inserted;
        totals.updated += result.updated;
        totals.skipped += parsed.skipped;
        const ids = parsed.workouts.map((item) => item.workout.lyftaId);
        allIds.push(...ids);
        await onPage(page, ids);
        if (page >= parsed.totalPages || parsed.workouts.length === 0) break;
      }
      return allIds;
    };

    if (state.lastSuccessAt === null) {
      const savedPage = Number(state.cursor ?? 1);
      const startPage = Number.isInteger(savedPage) && savedPage >= 1 ? savedPage : 1;
      await fetchPages(startPage, {}, (page) => syncState.saveCursor('lyfta', String(page + 1)));
      await syncState.recordSuccess('lyfta', syncedAt, null);
      return { status: 'ok', mode: 'backfill', deleted: 0, ...totals };
    }

    const window = incrementalWindow(new Date(state.lastSuccessAt), deps.now());
    const returnedIds = await fetchPages(1, window, async () => {});
    // Only reached when every page succeeded, so a partial response can never delete data.
    const deleted = await workouts.deleteMissingInRange(
      `${window.from}T00:00:00.000Z`,
      `${window.to}T23:59:59.999Z`,
      returnedIds,
    );
    await syncState.recordSuccess('lyfta', syncedAt, null);
    return { status: 'ok', mode: 'incremental', deleted, ...totals };
  } catch (error) {
    const errorAt = deps.now().toISOString();
    if (error instanceof LyftaError && error.kind === 'unauthorized') {
      await syncState.recordError('lyfta', 'invalid_key', errorAt);
      return { status: 'invalid_key' };
    }
    const message = error instanceof Error && error.message !== '' ? error.message : FALLBACK_ERROR_MESSAGE;
    await syncState.recordError('lyfta', message, errorAt);
    return { status: 'error', message };
  }
}

/**
 * Wraps `syncLyfta` so overlapping triggers (app start, pull-to-refresh) share one run instead of
 * double-fetching and hitting rate limits.
 */
export function createLyftaSyncRunner(deps: LyftaSyncDeps): { run(): Promise<LyftaSyncResult> } {
  let inFlight: Promise<LyftaSyncResult> | null = null;
  return {
    run() {
      if (inFlight === null) {
        inFlight = syncLyfta(deps).finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    },
  };
}
