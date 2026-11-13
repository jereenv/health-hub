import * as Haptics from 'expo-haptics';

/** A light tick for tab and range changes. Haptics are decoration, so failures are ignored. */
export function selectionHaptic(): void {
  Haptics.selectionAsync().catch(() => undefined);
}
