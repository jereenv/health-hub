import { formatMonthShort } from '@/domain/format/dates';
import type { RangeKind, SeriesPoint } from '@/domain/series/buckets';
import type { DateKey } from '@/domain/time/localDate';
import { parseDateKey } from '@/domain/time/localDate';
import type { ChartDatum } from '@/ui/charts/TrendChart';
import { toChartData } from '@/ui/screens/workouts/chartData';

export const RANGE_CAPTIONS: Record<RangeKind, string> = {
  day: 'last 30 days',
  week: 'last 12 weeks',
  month: 'last 12 months',
};

/** The Workouts chart points, with a month tooltip like "Nov 2026". */
export function toActivityChartData(
  points: readonly SeriesPoint[],
  range: RangeKind,
  today: DateKey,
): ChartDatum[] {
  const data = toChartData(points, range, today);
  if (range !== 'month') return data;
  return data.map((datum) => ({
    ...datum,
    tooltipLabel: `${formatMonthShort(datum.key)} ${parseDateKey(datum.key).year}`,
  }));
}

/** Week and month points are per-day averages, so say so. */
export function withPerDaySuffix(
  formatValue: (v: number) => string,
  range: RangeKind,
): (v: number) => string {
  return range === 'day' ? formatValue : (v) => `${formatValue(v)} avg/day`;
}
