import type { SecretStore } from '@/data/secrets/SecretStore';
import { SECRET_KEYS } from '@/data/secrets/SecretStore';
import type { SettingsRepository } from '@/data/settings/SettingsRepository';
import type { SyncStateRepository } from '@/data/sync/SyncStateRepository';
import type { WorkoutRepository } from '@/data/workouts/WorkoutRepository';
import type { WeightUnit } from '@/domain/workouts/types';

import type { LyftaClient } from './LyftaClient';
import { LyftaError } from './LyftaError';
import { readAccountUnit } from './lyftaUnit';
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

const WEIGHT_UNIT_ERROR = 'Could not determine the Lyfta weight unit';

/** Reads the weight unit setting; when unset, asks Lyfta once and persists the answer. */
async function resolveWeightUnit(
  client: LyftaClient,
  settings: SettingsRepository,
): Promise<WeightUnit> {
  const saved = await settings.get('lyfta.weightUnit');
  if (saved === 'lb' || saved === 'kg') return saved;

  const progress = await client.getExerciseProgress();
  const unit = readAccountUnit(progress);
  // Never guess: a wrong unit would silently scale every stored weight.
  if (unit === null) throw new Error(WEIGHT_UNIT_ERROR);
  await settings.set('lyfta.weightUnit', unit);
  return unit;
}

interface BackfillCursor {
  page: number;
  /** ISO time the backfill began; null for a legacy cursor that stored only a page number. */
  startedAt: string | null;
}

/** Reads the saved cursor: JSON `{page, startedAt}`, or a legacy plain page number. */
function parseBackfillCursor(cursor: string | null): BackfillCursor {
  if (cursor === null) return { page: 1, startedAt: null };
  try {
    const parsed: unknown = JSON.parse(cursor);
    if (typeof parsed === 'number') {
      return { page: Number.isInteger(parsed) && parsed >= 1 ? parsed : 1, startedAt: null };
    }
    if (typeof parsed === 'object' && parsed !== null) {
      const { page, startedAt } = parsed as { page?: unknown; startedAt?: unknown };
      const validPage = typeof page === 'number' && Number.isInteger(page) && page >= 1 ? page : 1;
      const validStart =
        typeof startedAt === 'string' && !Number.isNaN(new Date(startedAt).getTime())
          ? startedAt
          : null;
      return { page: validPage, startedAt: validStart };
    }
  } catch {
    // Not JSON; fall through to a fresh start.
  }
  return { page: 1, startedAt: null };
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

  try {
    const apiKey = await secrets.get(SECRET_KEYS.lyftaApiKey);
    if (apiKey === null || apiKey === '') return { status: 'not_configured' };

    const unit = await resolveWeightUnit(client, settings);
    const state = await syncState.get('lyfta');
    const totals: Totals = { inserted: 0, updated: 0, skipped: 0 };
    const syncedAt = deps.now().toISOString();

    /**
     * Fetches pages starting at `startPage` until the last one, storing the workouts accepted by
     * `keep`. Returns the ids of all returned workouts and how many were skipped as unparseable.
     */
    const fetchPages = async (
      startPage: number,
      range: { from?: string; to?: string },
      onPage: (page: number) => Promise<void>,
      keep: (lyftaId: number) => boolean = () => true,
    ): Promise<{ ids: number[]; skipped: number }> => {
      const allIds: number[] = [];
      let skipped = 0;
      for (let page = startPage; ; page += 1) {
        const json = await client.listWorkouts({ page, limit: LYFTA_PAGE_SIZE, ...range });
        const parsed = parseWorkoutPage(json, unit);
        const accepted = parsed.workouts.filter((item) => keep(item.workout.lyftaId));
        const result = await workouts.upsertMany(accepted, syncedAt);
        totals.inserted += result.inserted;
        totals.updated += result.updated;
        skipped += parsed.skipped;
        allIds.push(...parsed.workouts.map((item) => item.workout.lyftaId));
        await onPage(page);
        // A page of only skipped workouts is not the end; only an empty page or the last page is.
        if (page >= parsed.totalPages || parsed.workouts.length + parsed.skipped === 0) break;
      }
      return { ids: allIds, skipped };
    };

    /**
     * A workout missing from the windowed response may have been deleted in Lyfta, or may have had
     * its date moved outside the window (or sit on a day boundary the server filters differently).
     * Only the full listing can tell: candidates found there are refreshed, the rest are deleted.
     * Any failure or skipped workout means deleting nothing this run.
     */
    const confirmDeletions = async (
      candidates: ReadonlySet<number>,
      windowedIds: readonly number[],
      fromIso: string,
      toIso: string,
    ): Promise<number> => {
      try {
        const full = await fetchPages(
          1,
          {},
          async () => {},
          (id) => candidates.has(id),
        );
        if (full.skipped > 0) return 0;
        return await workouts.deleteMissingInRange(fromIso, toIso, [...windowedIds, ...full.ids]);
      } catch {
        return 0;
      }
    };

    if (state.lastSuccessAt === null) {
      const saved = parseBackfillCursor(state.cursor);
      // A legacy cursor has no start time, so this run's own start is the best available.
      const startedAt = saved.startedAt ?? syncedAt;
      const outcome = await fetchPages(saved.page, {}, (page) =>
        syncState.saveCursor('lyfta', JSON.stringify({ page: page + 1, startedAt })),
      );
      totals.skipped += outcome.skipped;
      // Lyfta pages newest-first, so workouts logged during a pause are on pages this run skipped.
      // Recording the original start makes the first incremental window reach back over the pause.
      await syncState.recordSuccess('lyfta', startedAt, null);
      return { status: 'ok', mode: 'backfill', deleted: 0, ...totals };
    }

    const window = incrementalWindow(new Date(state.lastSuccessAt), deps.now());
    const fromIso = `${window.from}T00:00:00.000Z`;
    const toIso = `${window.to}T23:59:59.999Z`;
    const windowed = await fetchPages(1, window, async () => {});
    totals.skipped += windowed.skipped;
    // Only reached when every page succeeded, so a partial response can never delete data.
    // Skipped (unparseable) workouts have no id in the returned ids, so deleting while any were
    // skipped could remove stored workouts that still exist in Lyfta; retry once they parse.
    let deleted = 0;
    if (totals.skipped === 0) {
      const returned = new Set(windowed.ids);
      const localIds = await workouts.listIdsInRange(fromIso, toIso);
      const candidates = new Set(localIds.filter((id) => !returned.has(id)));
      if (candidates.size > 0) {
        deleted = await confirmDeletions(candidates, windowed.ids, fromIso, toIso);
      }
    }
    await syncState.recordSuccess('lyfta', syncedAt, null);
    return { status: 'ok', mode: 'incremental', deleted, ...totals };
  } catch (error) {
    const errorAt = deps.now().toISOString();
    const isInvalidKey = error instanceof LyftaError && error.kind === 'unauthorized';
    const message =
      error instanceof Error && error.message !== '' ? error.message : FALLBACK_ERROR_MESSAGE;
    try {
      await syncState.recordError('lyfta', isInvalidKey ? 'invalid_key' : message, errorAt);
    } catch {
      // Bookkeeping failed too; still report the original outcome rather than rejecting.
    }
    return isInvalidKey ? { status: 'invalid_key' } : { status: 'error', message };
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
