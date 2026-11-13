import type { ScheduleRepository } from '@/data/schedule/ScheduleRepository';
import type { SyncStateRepository } from '@/data/sync/SyncStateRepository';
import { addDays, localDateKey, type DateKey } from '@/domain/time/localDate';

import type { LyftaClient } from './LyftaClient';
import { LyftaError } from './LyftaError';
import { pageCapFor, tooManyPagesError } from './paging';
import { parseSchedulePage, type ParsedScheduledWorkout } from './parseSchedule';

/** Schedule items requested per page. */
export const SCHEDULE_PAGE_SIZE = 100;

/** The window is 7 days back and 28 ahead of today, each padded by one day. */
const DAYS_BACK = 8;
const DAYS_FORWARD = 29;
const FALLBACK_ERROR_MESSAGE = 'Lyfta schedule sync failed';

/** The calendar days whose schedule is synced and replaced around `today`. */
export function scheduleWindow(today: DateKey): { from: DateKey; to: DateKey } {
  return { from: addDays(today, -DAYS_BACK), to: addDays(today, DAYS_FORWARD) };
}

export type ScheduleSyncResult =
  | { status: 'ok'; upserted: number; deleted: number; skipped: number }
  | { status: 'invalid_key' }
  | { status: 'error'; message: string };

export interface ScheduleSyncDeps {
  client: LyftaClient;
  schedule: ScheduleRepository;
  syncState: SyncStateRepository;
  /** Injected so tests control the clock. */
  now: () => Date;
}

/**
 * Replaces the stored schedule window with Lyfta's. Rows are deleted only when every page was
 * read and no item was skipped, so a partial or unreadable response can never remove data.
 * Never rejects: failures are recorded in the sync state and returned.
 */
export async function syncLyftaSchedule(deps: ScheduleSyncDeps): Promise<ScheduleSyncResult> {
  const { client, schedule, syncState } = deps;
  try {
    const at = deps.now();
    const { from, to } = scheduleWindow(localDateKey(at));

    const items: ParsedScheduledWorkout[] = [];
    let skipped = 0;
    let cap: number | null = null;
    for (let page = 1; ; page += 1) {
      if (cap !== null && page > cap) throw tooManyPagesError();
      const json = await client.listSchedule({
        from,
        to,
        includeCompleted: true,
        page,
        limit: SCHEDULE_PAGE_SIZE,
      });
      const parsed = parseSchedulePage(json);
      cap ??= pageCapFor(parsed.totalRecords, SCHEDULE_PAGE_SIZE);
      items.push(...parsed.items);
      skipped += parsed.skipped;
      // A page of only skipped items is not the end; only an empty page or the last page is.
      if (parsed.currentPage >= parsed.totalPages || parsed.items.length + parsed.skipped === 0) {
        break;
      }
    }

    const syncedAt = at.toISOString();
    const { upserted, deleted } = await schedule.replaceRange(
      from,
      to,
      items,
      syncedAt,
      skipped === 0,
    );
    await syncState.recordSuccess('lyfta_schedule', syncedAt, null, {
      skipped,
      deletionPause: null,
    });
    return { status: 'ok', upserted, deleted, skipped };
  } catch (error) {
    const isInvalidKey = error instanceof LyftaError && error.kind === 'unauthorized';
    const message =
      error instanceof Error && error.message !== '' ? error.message : FALLBACK_ERROR_MESSAGE;
    try {
      await syncState.recordError(
        'lyfta_schedule',
        isInvalidKey ? 'invalid_key' : message,
        deps.now().toISOString(),
      );
    } catch {
      // Bookkeeping failed too; still report the original outcome rather than rejecting.
    }
    return isInvalidKey ? { status: 'invalid_key' } : { status: 'error', message };
  }
}
