import {
  formatDayMonth,
  formatMonthShort,
  formatMonthYear,
  formatShortDate,
} from '@/domain/format/dates';
import type { RangeKind, SeriesPoint } from '@/domain/series/buckets';
import type { DateKey } from '@/domain/time/localDate';
import type { ChartDatum } from '@/ui/charts/TrendChart';

/** Chart points with the tooltip and axis text for each range. */
export function toChartData(
  points: readonly SeriesPoint[],
  range: RangeKind,
  today: DateKey,
): ChartDatum[] {
  return points.map((point, index) => {
    const isLast = index === points.length - 1;
    if (range === 'day') {
      return {
        key: point.start,
        value: point.value,
        tooltipLabel: formatShortDate(point.start),
        axisLabel: isLast && point.start === today ? 'Today' : formatDayMonth(point.start),
      };
    }
    if (range === 'week') {
      return {
        key: point.start,
        value: point.value,
        tooltipLabel: `Week of ${formatDayMonth(point.start)}`,
        axisLabel: formatDayMonth(point.start),
      };
    }
    return {
      key: point.start,
      value: point.value,
      tooltipLabel: formatMonthYear(point.start),
      axisLabel: formatMonthShort(point.start),
    };
  });
}
