import { addDays, monthStartKey, weekStartKey, type DateKey } from '@/domain/time/localDate';

export type RangeKind = 'day' | 'week' | 'month';
export type Aggregate = 'sum' | 'max' | 'mean';

export interface DatedValue {
  date: DateKey;
  value: number;
}

/** One chart point: the bucket's first day, its aggregate, and how many input values it holds. */
export interface SeriesPoint {
  start: DateKey;
  value: number;
  count: number;
}

/** The first day of the bucket (Monday for weeks) that contains `date`. */
export function bucketStart(date: DateKey, range: RangeKind): DateKey {
  if (range === 'week') return weekStartKey(date);
  if (range === 'month') return monthStartKey(date);
  return date;
}

/** The first day of the bucket after the one starting at `start`. */
export function nextBucketStart(start: DateKey, range: RangeKind): DateKey {
  if (range === 'day') return addDays(start, 1);
  if (range === 'week') return addDays(start, 7);
  // 31 days from the 1st always lands inside the next month.
  return monthStartKey(addDays(start, 31));
}

/** Groups values into buckets and aggregates each. Ascending by start; empty buckets are absent. */
export function bucketSeries(
  values: readonly DatedValue[],
  range: RangeKind,
  aggregate: Aggregate,
): SeriesPoint[] {
  const groups = new Map<DateKey, number[]>();
  for (const { date, value } of values) {
    const start = bucketStart(date, range);
    const group = groups.get(start);
    if (group) group.push(value);
    else groups.set(start, [value]);
  }

  return [...groups.keys()].sort().map((start) => {
    const group = groups.get(start) ?? [];
    const sum = group.reduce((total, value) => total + value, 0);
    const value =
      aggregate === 'sum' ? sum : aggregate === 'max' ? Math.max(...group) : sum / group.length;
    return { start, value, count: group.length };
  });
}

/** One point per bucket from the bucket holding `from` to the one holding `to`; gaps become zero. */
export function fillEmptyBuckets(
  points: readonly SeriesPoint[],
  range: RangeKind,
  from: DateKey,
  to: DateKey,
): SeriesPoint[] {
  const byStart = new Map(points.map((point) => [point.start, point]));
  const last = bucketStart(to, range);
  const filled: SeriesPoint[] = [];
  for (let start = bucketStart(from, range); start <= last; start = nextBucketStart(start, range)) {
    filled.push(byStart.get(start) ?? { start, value: 0, count: 0 });
  }
  return filled;
}
