import { z } from 'zod';

import { addDays, daysBetween, isDateKey } from '@/domain/time/localDate';
import type { DateKey } from '@/domain/time/localDate';

import { WINDOW_DAYS_BACK } from './constants';
import type { DateRange } from './HealthConnectGateway';

/** Stored in sync_state.cursor for the health_connect source. */
export interface HealthConnectCursor {
  v: 1;
  /** The local day of the last successful run. */
  syncedThrough: DateKey;
  /** Whether history access was granted during that run. */
  history: boolean;
}

/** Days read when Health Connect has no data to date the first import from. */
const FALLBACK_DAYS = 30;

const cursorSchema = z.object({
  v: z.literal(1),
  syncedThrough: z.string().refine(isDateKey),
  history: z.boolean(),
});

/** Anything malformed counts as no cursor, so a bad row means a full import, never a failure. */
export function parseCursor(raw: string | null): HealthConnectCursor | null {
  if (raw === null) return null;
  try {
    const parsed = cursorSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function planImport(input: {
  cursor: HealthConnectCursor | null;
  historyGranted: boolean;
  today: DateKey;
  earliest: DateKey | null;
}): { mode: 'full' | 'incremental'; range: DateRange } {
  const { cursor, historyGranted, today, earliest } = input;
  const toExclusive = addDays(today, 1);
  if (cursor === null || (historyGranted && !cursor.history)) {
    return {
      mode: 'full',
      range: { from: earliest ?? addDays(today, -FALLBACK_DAYS), toExclusive },
    };
  }
  return {
    mode: 'incremental',
    range: { from: addDays(cursor.syncedThrough, -WINDOW_DAYS_BACK), toExclusive },
  };
}

/** Consecutive ranges of at most `days` days that cover `range` exactly; none is empty. */
export function chunkRange(range: DateRange, days: number): DateRange[] {
  if (!(days >= 1)) throw new RangeError('days must be at least 1');
  const chunks: DateRange[] = [];
  let from = range.from;
  while (daysBetween(from, range.toExclusive) > 0) {
    const next = addDays(from, days);
    const toExclusive = daysBetween(next, range.toExclusive) < 0 ? range.toExclusive : next;
    chunks.push({ from, toExclusive });
    from = toExclusive;
  }
  return chunks;
}
