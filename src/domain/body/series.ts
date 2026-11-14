import type { WatchBodyFat } from '@/data/healthconnect/HealthConnectRepository';
import type { RangeKind } from '@/domain/series/buckets';
import { bucketStart } from '@/domain/series/buckets';
import type { DateKey } from '@/domain/time/localDate';
import { addDays, daysBetween, localDateKey, monthStartKey } from '@/domain/time/localDate';

import type { ReadingMetrics } from './readings';
import { isLegacyOrigin } from './types';
import type { MetricId, Origin } from './types';

export interface DayPoint {
  date: DateKey;
  value: number;
  origin: Origin;
  readingId: number;
}

/** How many day, week or month slots each range shows, ending with the one holding today. */
export const BODY_SPAN: Readonly<Record<RangeKind, number>> = { day: 30, week: 26, month: 24 };

export interface SlotPoint {
  start: DateKey;
  value: number | null;
  hollow: boolean;
  count: number;
}

export interface SeriesStats {
  average: number;
  lowest: number;
  highest: number;
  change: number | null;
}

export interface MetricSeries {
  /** BODY_SPAN[range] slots ending with the one holding today. */
  slots: SlotPoint[];
  /** Aligned to slots, Day range only; null for the other ranges. */
  average7: Array<number | null> | null;
  /** Ruling 7: points of the latest point's method inside the visible span. */
  stats: SeriesStats | null;
  /** The latest day point overall, even outside the visible span. */
  current: DayPoint | null;
  /** The visible span holds both solid and hollow points. */
  mixed: boolean;
}

const CHANGE_WINDOW_DAYS = 30;
const MIN_CHANGE_SPAN_DAYS = 7;

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isHollow(point: DayPoint): boolean {
  return isLegacyOrigin(point.origin);
}

/** Ruling 12: a day's point is the first reading of the local day that has the metric. */
export function dayPoints(readings: readonly ReadingMetrics[], metric: MetricId): DayPoint[] {
  const byDate = new Map<DateKey, DayPoint>();
  for (const reading of readings) {
    const metricValue = reading.metrics[metric];
    if (!metricValue || byDate.has(reading.date)) continue;
    byDate.set(reading.date, {
      date: reading.date,
      value: metricValue.value,
      origin: metricValue.origin,
      readingId: reading.id,
    });
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function previousBucketStart(start: DateKey, range: RangeKind): DateKey {
  if (range === 'day') return addDays(start, -1);
  if (range === 'week') return addDays(start, -7);
  return monthStartKey(addDays(start, -1));
}

/** Slot starts, oldest first, ending with the bucket that holds `today`. */
function slotStarts(range: RangeKind, today: DateKey): DateKey[] {
  const starts: DateKey[] = [bucketStart(today, range)];
  while (starts.length < BODY_SPAN[range]) {
    starts.unshift(previousBucketStart(starts[0] as DateKey, range));
  }
  return starts;
}

function buildSlot(start: DateKey, points: readonly DayPoint[]): SlotPoint {
  if (points.length === 0) return { start, value: null, hollow: false, count: 0 };
  const solid = points.filter((point) => !isHollow(point));
  const used = solid.length > 0 ? solid : points;
  return {
    start,
    value: mean(used.map((point) => point.value)),
    hollow: solid.length === 0,
    count: used.length,
  };
}

function statsFor(points: readonly DayPoint[]): SeriesStats | null {
  const last = points[points.length - 1];
  const first = points[0];
  if (!last || !first) return null;
  const values = points.map((point) => point.value);
  return {
    average: mean(values),
    lowest: Math.min(...values),
    highest: Math.max(...values),
    change: points.length >= 2 ? last.value - first.value : null,
  };
}

/** Day points ascending in `days` that share the latest point's method. */
function sameMethodAsLatest(points: readonly DayPoint[]): DayPoint[] {
  const latest = points[points.length - 1];
  if (!latest) return [];
  return points.filter((point) => isHollow(point) === isHollow(latest));
}

export function buildMetricSeries(
  days: readonly DayPoint[],
  range: RangeKind,
  today: DateKey,
): MetricSeries {
  const starts = slotStarts(range, today);
  const byBucket = new Map<DateKey, DayPoint[]>();
  for (const point of days) {
    const key = bucketStart(point.date, range);
    const group = byBucket.get(key);
    if (group) group.push(point);
    else byBucket.set(key, [point]);
  }
  const slots = starts.map((start) => buildSlot(start, byBucket.get(start) ?? []));

  const average7 =
    range === 'day'
      ? slots.map((slot) => {
          if (slot.value === null) return null;
          const from = addDays(slot.start, -6);
          const window = days.filter(
            (point) =>
              point.date >= from && point.date <= slot.start && isHollow(point) === slot.hollow,
          );
          return window.length > 0 ? mean(window.map((point) => point.value)) : null;
        })
      : null;

  const spanFrom = starts[0] as DateKey;
  const inSpan = days.filter((point) => point.date >= spanFrom && point.date <= today);

  return {
    slots,
    average7,
    stats: statsFor(sameMethodAsLatest(inSpan)),
    current: days[days.length - 1] ?? null,
    mixed: inSpan.some(isHollow) && inSpan.some((point) => !isHollow(point)),
  };
}

/** Same-method points of the last 30 days (today included). */
function recentSameMethod(days: readonly DayPoint[], today: DateKey): DayPoint[] {
  const from = addDays(today, -(CHANGE_WINDOW_DAYS - 1));
  return sameMethodAsLatest(days.filter((point) => point.date >= from && point.date <= today));
}

/**
 * Last minus first of the latest method's points in the last 30 days. Null unless there are two
 * points at least 7 days apart.
 */
export function change30(days: readonly DayPoint[], today: DateKey): number | null {
  const points = recentSameMethod(days, today);
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || points.length < 2) return null;
  if (daysBetween(first.date, last.date) < MIN_CHANGE_SPAN_DAYS) return null;
  return last.value - first.value;
}

/** Day range only: the mean of that day's watch checks for each slot, null where there are none. */
export function watchByDay(
  checks: readonly WatchBodyFat[],
  slots: readonly SlotPoint[],
): Array<number | null> {
  const byDate = new Map<DateKey, number[]>();
  for (const check of checks) {
    const date = localDateKey(check.measuredAt);
    const group = byDate.get(date);
    if (group) group.push(check.bodyFatPct);
    else byDate.set(date, [check.bodyFatPct]);
  }
  return slots.map((slot) => {
    const group = byDate.get(slot.start);
    return group ? mean(group) : null;
  });
}
