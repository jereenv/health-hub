import { formatInteger } from '@/domain/format/numbers';
import { kgToUnit } from '@/domain/format/units';
import type { WeightUnit } from '@/domain/workouts/types';

import { METRIC_META } from './types';
import type { MetricId, Origin, Tier } from './types';

const MINUS = '−';

function fixed(value: number, decimals: number): string {
  const text = value.toFixed(decimals);
  return Number(text) === 0 ? (0).toFixed(decimals) : text;
}

/** The value and unit to display. Masses follow the weight unit; BMR has a thousands separator. */
export function formatMetricValue(
  metric: MetricId,
  value: number,
  unit: WeightUnit,
): { value: string; unit: string } {
  const meta = METRIC_META[metric];
  switch (meta.kind) {
    case 'mass':
      return { value: fixed(kgToUnit(value, unit), 1), unit };
    case 'percent':
      return { value: fixed(value, 1), unit: '%' };
    case 'index':
      return { value: fixed(value, 1), unit: '' };
    case 'energy':
      return { value: formatInteger(value), unit: meta.unit };
    case 'rating':
      return { value: fixed(value, 0), unit: '' };
    case 'age':
      return { value: fixed(value, 0), unit: meta.unit };
  }
}

/** A signed change with a true minus: "−1.3 pts" for percent metrics, "−2.4 kg" for masses. */
export function formatMetricChange(metric: MetricId, change: number, unit: WeightUnit): string {
  const meta = METRIC_META[metric];
  const shown = meta.kind === 'mass' ? kgToUnit(change, unit) : change;
  const decimals = meta.kind === 'mass' || meta.kind === 'percent' || meta.kind === 'index' ? 1 : 0;
  const text = Math.abs(shown).toFixed(decimals);
  const sign = Number(text) === 0 ? '' : shown > 0 ? '+' : MINUS;
  const suffix = (() => {
    switch (meta.kind) {
      case 'mass':
        return ` ${unit}`;
      case 'percent':
        return ' pts';
      case 'energy':
        return ' kcal';
      case 'age':
        return ' yrs';
      default:
        return '';
    }
  })();
  return `${sign}${text}${suffix}`;
}

export const TIER_LABEL: Readonly<Record<Tier, string>> = {
  measured: 'Measured',
  exact: 'Exact',
  estimated: 'Estimated',
  rough: 'Rough',
};

export const ORIGIN_LABEL: Readonly<Record<Origin, string | null>> = {
  scale: null,
  formula: null,
  movinglife: 'MovingLife',
  movinglife_derived: 'From MovingLife body fat',
};
