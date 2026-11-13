import type { HeartRateDay } from '@/data/healthconnect/HealthConnectRepository';
import type { RangeKind, SeriesPoint } from '@/domain/series/buckets';
import { bucketSeries } from '@/domain/series/buckets';
import type { DateKey } from '@/domain/time/localDate';

import { spanStart } from './activitySeries';

export interface HeartRateSummary {
  /** Mean of the daily averages per bucket. Empty buckets are absent: 0 bpm is meaningless. */
  points: SeriesPoint[];
  lowest: number | null;
  average: number | null;
  highest: number | null;
}

export function buildHeartRateSummary(
  days: readonly HeartRateDay[],
  range: RangeKind,
  today: DateKey,
): HeartRateSummary {
  const from = spanStart(range, today);
  const visible = days.filter((d) => d.date >= from && d.date <= today);
  if (visible.length === 0) return { points: [], lowest: null, average: null, highest: null };
  return {
    points: bucketSeries(
      visible.map((d) => ({ date: d.date, value: d.avgBpm })),
      range,
      'mean',
    ),
    lowest: Math.min(...visible.map((d) => d.minBpm)),
    average: visible.reduce((sum, d) => sum + d.avgBpm, 0) / visible.length,
    highest: Math.max(...visible.map((d) => d.maxBpm)),
  };
}
