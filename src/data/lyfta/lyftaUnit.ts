import type { WeightUnit } from '@/domain/workouts/types';

const KG_ALIASES: ReadonlySet<string> = new Set(['kg', 'kgs', 'kilogram', 'kilograms']);
const LB_ALIASES: ReadonlySet<string> = new Set(['lb', 'lbs', 'pound', 'pounds']);

/** Maps Lyfta's unit spellings (any case, surrounding spaces allowed) to a `WeightUnit`. */
export function parseWeightUnit(value: unknown): WeightUnit | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (KG_ALIASES.has(normalized)) return 'kg';
  if (LB_ALIASES.has(normalized)) return 'lb';
  return null;
}

/** Reads the account unit from the top-level `weight_unit` of `/exercises/progress`. */
export function readAccountUnit(progressJson: unknown): WeightUnit | null {
  if (typeof progressJson !== 'object' || progressJson === null) return null;
  return parseWeightUnit((progressJson as Record<string, unknown>).weight_unit);
}
