import { LB_TO_KG } from '@/domain/format/units';
import type { WeightUnit, WorkoutSet } from '@/domain/workouts/types';
import { makeSet } from '@/test-support/workoutBuilders';

import { describeSetChip } from './setChipText';

test.each<[Partial<WorkoutSet>, WeightUnit, boolean, object]>([
  [
    { weightKg: 90, reps: 3, rir: 1, completed: true, position: 2 },
    'kg',
    true,
    {
      main: '90 × 3',
      sub: 'PR · RIR 1',
      tone: 'pr',
      accessibilityLabel: 'Set 3, 90 kg × 3, RIR 1, personal record',
    },
  ],
  [
    { weightKg: null, reps: 12, rir: null, completed: true },
    'kg',
    false,
    { main: '12 reps', sub: ' ', tone: 'plain' },
  ],
  [
    { weightKg: 135 * LB_TO_KG, reps: 5, rir: 2, completed: false },
    'lb',
    false,
    { main: '135 × 5', sub: 'RIR 2 · Not done', tone: 'dim' },
  ],
  [
    { weightKg: null, reps: null, rir: null, completed: true },
    'kg',
    false,
    { main: '—', sub: ' ', tone: 'plain' },
  ],
])('describeSetChip %#', (set, unit, pr, expected) => {
  expect(describeSetChip(makeSet(set), unit, pr)).toMatchObject(expected);
});
