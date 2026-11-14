import {
  formatDayMonth,
  formatMonthShort,
  formatMonthYear,
  formatShortDate,
} from '@/domain/format/dates';
import type { MetricSeries, SlotPoint } from '@/domain/body/series';
import type { RangeKind } from '@/domain/series/buckets';
import type { DateKey } from '@/domain/time/localDate';
import type { ChartDatum } from '@/ui/charts/TrendChart';

function labelsFor(
  slot: SlotPoint,
  range: RangeKind,
  isLast: boolean,
  today: DateKey,
): Pick<ChartDatum, 'tooltipLabel' | 'axisLabel'> {
  if (range === 'day') {
    return {
      tooltipLabel: formatShortDate(slot.start),
      axisLabel: isLast && slot.start === today ? 'Today' : formatDayMonth(slot.start),
    };
  }
  if (range === 'week') {
    return {
      tooltipLabel: `Week of ${formatDayMonth(slot.start)}`,
      axisLabel: formatDayMonth(slot.start),
    };
  }
  return {
    tooltipLabel: formatMonthYear(slot.start),
    axisLabel: `${formatMonthShort(slot.start)} ${slot.start.slice(2, 4)}`,
  };
}

/**
 * One chart datum per slot, empty slots included. A datum is hollow when its method is
 * MovingLife's, and the line breaks where the method differs from the previous filled slot
 * (Ruling 7).
 */
export function toBodyChartData(
  series: MetricSeries,
  range: RangeKind,
  today: DateKey,
): ChartDatum[] {
  let previousHollow: boolean | null = null;
  return series.slots.map((slot, index) => {
    const datum: ChartDatum = {
      key: slot.start,
      value: slot.value,
      ...labelsFor(slot, range, index === series.slots.length - 1, today),
    };
    if (slot.value === null) return datum;
    datum.hollow = slot.hollow;
    datum.breakBefore = previousHollow !== null && previousHollow !== slot.hollow;
    previousHollow = slot.hollow;
    return datum;
  });
}

export interface LegendEntry {
  label: 'Scale' | 'MovingLife';
  hollow: boolean;
}

/** Names the methods of the visible points: MovingLife's are hollow, everything else is the scale. */
export function legendEntries(series: MetricSeries): LegendEntry[] {
  const filled = series.slots.filter((slot) => slot.value !== null);
  const entries: LegendEntry[] = [];
  if (filled.some((slot) => !slot.hollow)) entries.push({ label: 'Scale', hollow: false });
  if (filled.some((slot) => slot.hollow)) entries.push({ label: 'MovingLife', hollow: true });
  return entries;
}
