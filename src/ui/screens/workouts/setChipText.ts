import { formatWeightNumber } from '@/domain/format/units';
import type { WeightUnit, WorkoutSet } from '@/domain/workouts/types';

const NBSP = ' ';

/** What a set chip shows. A set that can't be scored still displays. */
export function describeSetChip(
  set: WorkoutSet,
  unit: WeightUnit,
  isPr: boolean,
): { main: string; sub: string; tone: 'plain' | 'pr'; accessibilityLabel: string } {
  const hasReps = set.reps !== null && set.reps >= 1;
  const hasWeight = set.weightKg !== null && set.weightKg > 0;
  const main =
    hasReps && hasWeight
      ? `${formatWeightNumber(set.weightKg!, unit)} × ${set.reps}`
      : hasReps
        ? `${set.reps} reps`
        : '—';

  const parts = [...(isPr ? ['PR'] : []), ...(set.rir === null ? [] : [`RIR ${set.rir}`])];
  const sub = parts.length === 0 ? NBSP : parts.join(' · ');

  const spoken = [
    `Set ${set.position + 1}`,
    hasReps && hasWeight
      ? `${formatWeightNumber(set.weightKg!, unit)} ${unit} × ${set.reps}`
      : main,
    ...(set.rir === null ? [] : [`RIR ${set.rir}`]),
    ...(isPr ? ['personal record'] : []),
  ];
  return {
    main,
    sub,
    tone: isPr ? 'pr' : 'plain',
    accessibilityLabel: spoken.join(', '),
  };
}
