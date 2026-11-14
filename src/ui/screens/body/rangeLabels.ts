import { formatMetricValue } from '@/domain/body/formatMetric';
import { METRIC_META } from '@/domain/body/types';
import type { MetricId } from '@/domain/body/types';
import type { WeightUnit } from '@/domain/workouts/types';

/** Formats a range-bar cut-off: masses follow the display unit, everything else stays as is. */
export function rangeLabelFormatter(
  metric: MetricId,
  unit: WeightUnit,
): ((value: number) => string) | undefined {
  if (METRIC_META[metric].kind !== 'mass') return undefined;
  return (value) => formatMetricValue(metric, value, unit).value;
}
