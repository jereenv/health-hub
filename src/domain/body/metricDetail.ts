import type { WatchBodyFat } from '@/data/healthconnect/HealthConnectRepository';
import { formatMetricChange } from './formatMetric';
import type { Profile } from '@/domain/profile/profile';
import type { RangeKind } from '@/domain/series/buckets';
import type { DateKey } from '@/domain/time/localDate';
import type { WeightUnit } from '@/domain/workouts/types';

import { explainerSources } from './explainers';
import { rangeForProfile } from './profileRange';
import { NEUTRAL_DESCRIPTOR, classify } from './ranges';
import type { Classified, MetricRange } from './ranges';
import type { ReadingMetrics } from './readings';
import { buildMetricSeries, change30, dayPoints, watchByDay } from './series';
import type { DayPoint, MetricSeries } from './series';
import type { FormulaSource } from './sources';
import { tipFor } from './tips';
import { METRIC_IDS } from './types';
import type { MetricId, Tier } from './types';

/** The metric id in a route param, or null for anything that is not one of the 13 ids. */
export function parseMetricId(param: string | string[] | undefined): MetricId | null {
  if (typeof param !== 'string') return null;
  return METRIC_IDS.find((id) => id === param) ?? null;
}

export interface MetricDetail {
  /** The latest reading that has the metric: the value the Body page shows. */
  current: DayPoint | null;
  /** The current value is from the day of the latest weigh-in. */
  asOfLatest: boolean;
  range: MetricRange | null;
  classified: Classified | null;
  /** Taken from the reading the current value came from. */
  tier: Tier;
  series: MetricSeries;
  /** Body fat on the Day range only; aligned to the series slots. Never enters the stats. */
  watch: (number | null)[] | null;
  /** One sentence with `{x}` already replaced by the absolute 30-day change; null when none. */
  tip: string | null;
  /** The published sources for the formula; empty for MovingLife's own numbers. */
  sources: readonly FormulaSource[];
  /** The neutral word for a metric without a range, such as "Estimate". */
  descriptor: string | null;
}

export function buildMetricDetail(input: {
  metric: MetricId;
  readings: readonly ReadingMetrics[];
  /** The profile in effect at the latest reading. */
  profile: Profile | null;
  watch: readonly WatchBodyFat[];
  range: RangeKind;
  today: DateKey;
  unit: WeightUnit;
}): MetricDetail {
  const { metric, readings, profile, range, today, unit } = input;
  const days = dayPoints(readings, metric);
  const series = buildMetricSeries(days, range, today);
  const current = latestPoint(readings, metric);
  const latestDate = readings[readings.length - 1]?.date ?? null;
  const reading = current === null ? undefined : readings.find((r) => r.id === current.readingId);

  const metricRange = rangeForProfile(metric, profile, latestDate ?? today);
  const classified =
    metricRange !== null && current !== null ? classify(metricRange, current.value) : null;

  const change = change30(days, today);
  const weightPoints = metric === 'weight' ? days : dayPoints(readings, 'weight');
  const latestWeight = weightPoints[weightPoints.length - 1]?.value ?? null;
  const tipText = tipFor({
    metric,
    band: classified?.band.status ?? null,
    bandLabel: classified?.statusLabel ?? null,
    change30: change,
    goalWeightKg: profile?.goalWeightKg ?? null,
    latestWeightKg: latestWeight,
  });
  const tip =
    tipText === null ? null : tipText.replace('{x}', formatChangeSize(metric, change ?? 0, unit));

  const sources = current === null ? [] : explainerSources(metric, current.origin);

  return {
    current,
    asOfLatest: current !== null && current.date === latestDate,
    range: metricRange,
    classified,
    tier: reading?.metrics[metric]?.tier ?? 'estimated',
    series,
    watch:
      metric === 'body_fat_pct' && range === 'day' ? watchByDay(input.watch, series.slots) : null,
    tip,
    sources,
    descriptor: metricRange === null ? (NEUTRAL_DESCRIPTOR[metric] ?? null) : null,
  };
}

/**
 * The latest reading that has the metric, the same one the Body page shows. The chart keeps the
 * first reading of each day (Ruling 12); this is the headline value.
 */
function latestPoint(readings: readonly ReadingMetrics[], metric: MetricId): DayPoint | null {
  for (let i = readings.length - 1; i >= 0; i--) {
    const reading = readings[i] as ReadingMetrics;
    const value = reading.metrics[metric];
    if (value) {
      return {
        date: reading.date,
        value: value.value,
        origin: value.origin,
        readingId: reading.id,
      };
    }
  }
  return null;
}

/** "1.3" for points, "2.4 kg" for masses: the size of a change without its sign. */
function formatChangeSize(metric: MetricId, change: number, unit: WeightUnit): string {
  return formatMetricChange(metric, Math.abs(change), unit).replace(/^\+/, '').replace(' pts', '');
}
