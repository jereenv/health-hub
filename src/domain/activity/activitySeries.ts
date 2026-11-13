import type { ActivityDay } from '@/data/healthconnect/HealthConnectRepository';
import type { DatedValue, RangeKind, SeriesPoint } from '@/domain/series/buckets';
import { bucketSeries, bucketStart, fillEmptyBuckets } from '@/domain/series/buckets';
import type { DateKey } from '@/domain/time/localDate';
import { addDays, monthStartKey } from '@/domain/time/localDate';

export type ActivityMetric = 'steps' | 'distanceM' | 'activeKcal' | 'totalKcal';

/** How many buckets each range shows, ending with the one that holds today. */
export const ACTIVITY_SPAN: Readonly<Record<RangeKind, number>> = { day: 30, week: 12, month: 12 };

export interface ActivitySeries {
  /** One point per bucket in the span; buckets with no data are zero with `count` 0. */
  points: SeriesPoint[];
  /** Today's value, null when there is no row or no value. */
  today: number | null;
  /** Mean over completed days that have a value; null when there are none. */
  averagePerDay: number | null;
  bestDay: { date: DateKey; value: number } | null;
}

function previousBucketStart(start: DateKey, range: RangeKind): DateKey {
  if (range === 'day') return addDays(start, -1);
  if (range === 'week') return addDays(start, -7);
  return monthStartKey(addDays(start, -1));
}

/** The first day of the oldest bucket in the visible span. */
export function spanStart(range: RangeKind, today: DateKey): DateKey {
  let start = bucketStart(today, range);
  for (let i = 1; i < ACTIVITY_SPAN[range]; i++) start = previousBucketStart(start, range);
  return start;
}

/**
 * Mean per bucket over the visible span, gaps filled with zero. The day range always includes
 * today; week and month leave today out unless `countToday`, so a part-way bucket is not lowered.
 */
export function buildBucketedSeries(
  values: readonly DatedValue[],
  range: RangeKind,
  today: DateKey,
  countToday: boolean,
): SeriesPoint[] {
  const from = spanStart(range, today);
  const included = values.filter(
    (v) => v.date >= from && v.date <= today && (range === 'day' || countToday || v.date < today),
  );
  const points = fillEmptyBuckets(bucketSeries(included, range, 'mean'), range, from, today);
  // The bucket holding today may have no completed day yet; that is "no data", not a zero bar.
  const last = points[points.length - 1];
  return range !== 'day' && last !== undefined && last.count === 0 ? points.slice(0, -1) : points;
}

export function buildActivitySeries(
  days: readonly ActivityDay[],
  metric: ActivityMetric,
  range: RangeKind,
  today: DateKey,
): ActivitySeries {
  // A day with no value is missing data, not a zero.
  const values: DatedValue[] = [];
  for (const day of days) {
    const value = day[metric];
    if (value !== null) values.push({ date: day.date, value });
  }
  const from = spanStart(range, today);
  const completed = values.filter((v) => v.date >= from && v.date < today);

  let bestDay: ActivitySeries['bestDay'] = null;
  for (const v of completed) {
    if (bestDay === null || v.value > bestDay.value) bestDay = { date: v.date, value: v.value };
  }
  const averagePerDay =
    completed.length === 0
      ? null
      : completed.reduce((sum, v) => sum + v.value, 0) / completed.length;

  return {
    points: buildBucketedSeries(values, range, today, false),
    today: values.find((v) => v.date === today)?.value ?? null,
    averagePerDay,
    bestDay,
  };
}
