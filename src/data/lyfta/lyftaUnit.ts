import type { SettingsRepository } from '@/data/settings/SettingsRepository';
import type { WeightUnit } from '@/domain/workouts/types';

import type { LyftaClient } from './LyftaClient';

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

/**
 * Re-checks the account unit against Lyfta. Makes no request while no unit is stored (the first
 * sync resolves it). An unrecognised unit keeps the stored one; a different unit is saved and
 * reported as changed so the caller can re-parse. `LyftaError` propagates.
 */
export async function refreshLyftaUnit(deps: {
  client: LyftaClient;
  settings: SettingsRepository;
}): Promise<{ unit: WeightUnit | null; changed: boolean }> {
  const stored = parseWeightUnit(await deps.settings.get('lyfta.weightUnit'));
  if (stored === null) return { unit: null, changed: false };

  const detected = readAccountUnit(await deps.client.getExerciseProgress());
  if (detected === null || detected === stored) return { unit: detected, changed: false };

  await deps.settings.set('lyfta.weightUnit', detected);
  return { unit: detected, changed: true };
}
