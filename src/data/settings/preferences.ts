import type { WeightUnit } from '@/domain/workouts/types';

import type { SettingsRepository } from './SettingsRepository';

export interface Preferences {
  displayWeightUnit: WeightUnit;
  /** True only when the owner chose the display unit; otherwise it follows Lyfta. */
  displayUnitIsExplicit: boolean;
  /** The unit auto-detected from the Lyfta account; null until detected. */
  lyftaAccountUnit: WeightUnit | null;
}

/** Shaped for React's `useSyncExternalStore`. */
export interface PreferencesStore {
  /** Returns the same object until a preference changes. */
  getSnapshot(): Preferences;
  subscribe(listener: () => void): () => void;
  /** Re-reads the settings, e.g. after sync detects the Lyfta unit. */
  reload(): Promise<void>;
  setDisplayWeightUnit(unit: WeightUnit): Promise<void>;
}

function asWeightUnit(value: string | null): WeightUnit | null {
  return value === 'kg' || value === 'lb' ? value : null;
}

/** Explicit display unit, else the Lyfta account unit, else kg. Unrecognised strings count as absent. */
export function resolveDisplayUnit(display: string | null, lyfta: string | null): WeightUnit {
  return asWeightUnit(display) ?? asWeightUnit(lyfta) ?? 'kg';
}

async function readPreferences(settings: SettingsRepository): Promise<Preferences> {
  const display = asWeightUnit(await settings.get('display.weightUnit'));
  const lyfta = asWeightUnit(await settings.get('lyfta.weightUnit'));
  return {
    displayWeightUnit: resolveDisplayUnit(display, lyfta),
    displayUnitIsExplicit: display !== null,
    lyftaAccountUnit: lyfta,
  };
}

function isSamePreferences(a: Preferences, b: Preferences): boolean {
  return (
    a.displayWeightUnit === b.displayWeightUnit &&
    a.displayUnitIsExplicit === b.displayUnitIsExplicit &&
    a.lyftaAccountUnit === b.lyftaAccountUnit
  );
}

export async function createPreferencesStore(
  settings: SettingsRepository,
): Promise<PreferencesStore> {
  let snapshot = await readPreferences(settings);
  const listeners = new Set<() => void>();

  // Keeps the old object when nothing changed, so subscribers are not woken for nothing.
  async function refresh(): Promise<void> {
    const next = await readPreferences(settings);
    if (isSamePreferences(snapshot, next)) return;
    snapshot = next;
    for (const listener of [...listeners]) listener();
  }

  return {
    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    reload: refresh,

    async setDisplayWeightUnit(unit) {
      await settings.set('display.weightUnit', unit);
      await refresh();
    },
  };
}
