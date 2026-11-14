import type { PresetId } from './types';

/** Ruling 14: the question the starter box is pre-filled with. The owner can edit or clear it. */
export const DEFAULT_STARTER: Readonly<Record<PresetId, string>> = {
  week: 'Review my week and suggest changes',
  month: 'Review my month and suggest changes',
  journey: 'Look at my whole journey and tell me what is working',
  workout: 'Review this workout and tell me what to adjust',
  custom: 'Review this period and suggest changes',
};
