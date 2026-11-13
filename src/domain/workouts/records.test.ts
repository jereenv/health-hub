import { makeExercise, makeSet, makeWorkout } from '@/test-support/workoutBuilders';

import { computePersonalRecords, prSetKey, prSetKeys } from './records';

function bench(lyftaId: number, performedAt: string, sets: [number, number][], exerciseId = 1) {
  return makeWorkout({
    lyftaId,
    performedAt,
    exercises: [
      makeExercise({
        exerciseId,
        sets: sets.map(([weightKg, reps], position) => makeSet({ position, weightKg, reps })),
      }),
    ],
  });
}

test('first session of an exercise sets a baseline and is not a PR', () => {
  expect(computePersonalRecords([bench(1, '2026-01-01T10:00:00Z', [[80, 5]])])).toEqual([]);
});

test('a heavier top set than every earlier workout is a weight PR on that set only', () => {
  const records = computePersonalRecords([
    bench(1, '2026-01-01T10:00:00Z', [[80, 5]]),
    bench(2, '2026-01-08T10:00:00Z', [
      [85, 5],
      [90, 3],
    ]),
  ]);
  const weight = records.filter((r) => r.kind === 'weight');
  expect(weight).toEqual([
    {
      kind: 'weight',
      exerciseId: 1,
      lyftaId: 2,
      exercisePosition: 0,
      setPosition: 1,
      valueKg: 90,
      previousKg: 80,
    },
  ]);
});

test('equal weight is not a PR', () => {
  const records = computePersonalRecords([
    bench(1, '2026-01-01T10:00:00Z', [[80, 5]]),
    bench(2, '2026-01-08T10:00:00Z', [[80, 5]]),
  ]);
  expect(records).toEqual([]);
});

test('more reps at the same weight is an e1RM PR but not a weight PR', () => {
  const records = computePersonalRecords([
    bench(1, '2026-01-01T10:00:00Z', [[80, 5]]),
    bench(2, '2026-01-08T10:00:00Z', [[80, 8]]),
  ]);
  expect(records.map((r) => r.kind)).toEqual(['e1rm']);
  expect(records[0]?.valueKg).toBeCloseTo(80 * (1 + 8 / 30), 9);
  expect(records[0]?.previousKg).toBeCloseTo(80 * (1 + 5 / 30), 9);
});

test('sets above 12 reps never produce an e1RM PR', () => {
  const records = computePersonalRecords([
    bench(1, '2026-01-01T10:00:00Z', [[80, 5]]),
    bench(2, '2026-01-08T10:00:00Z', [[80, 20]]),
  ]);
  expect(records).toEqual([]);
});

test('workouts are ordered by time, not input order', () => {
  const later = bench(2, '2026-01-08T10:00:00Z', [[90, 3]]);
  const earlier = bench(1, '2026-01-01T10:00:00Z', [[80, 5]]);
  const records = computePersonalRecords([later, earlier]);
  expect(records.filter((r) => r.kind === 'weight').map((r) => r.lyftaId)).toEqual([2]);
});

test('ties on time are broken by lyftaId', () => {
  const records = computePersonalRecords([
    bench(2, '2026-01-01T10:00:00Z', [[90, 3]]),
    bench(1, '2026-01-01T10:00:00Z', [[80, 5]]),
  ]);
  expect(records.filter((r) => r.kind === 'weight').map((r) => r.lyftaId)).toEqual([2]);
});

test('an exercise repeated within one workout is scored once', () => {
  const workout = makeWorkout({
    lyftaId: 2,
    performedAt: '2026-01-08T10:00:00Z',
    exercises: [
      makeExercise({ position: 0, sets: [makeSet({ position: 0, weightKg: 90, reps: 3 })] }),
      makeExercise({ position: 1, sets: [makeSet({ position: 0, weightKg: 90, reps: 3 })] }),
    ],
  });
  const records = computePersonalRecords([bench(1, '2026-01-01T10:00:00Z', [[80, 5]]), workout]);
  const weight = records.filter((r) => r.kind === 'weight');
  expect(weight).toHaveLength(1);
  expect(weight[0]?.exercisePosition).toBe(0);
  expect(weight[0]?.setPosition).toBe(0);
});

test('a set can hold both kinds but counts once in prSetKeys', () => {
  const records = computePersonalRecords([
    bench(1, '2026-01-01T10:00:00Z', [[80, 5]]),
    bench(2, '2026-01-08T10:00:00Z', [[90, 5]]),
  ]);
  expect(records.map((r) => r.kind).sort()).toEqual(['e1rm', 'weight']);
  expect(prSetKeys(records)).toEqual(new Set([prSetKey(2, 0, 0)]));
  expect(prSetKey(2, 0, 0)).toBe('2:0:0');
});

test('exercises are tracked independently and sets without weight are ignored', () => {
  const w2 = makeWorkout({
    lyftaId: 2,
    performedAt: '2026-01-08T10:00:00Z',
    exercises: [
      makeExercise({
        exerciseId: 1,
        sets: [makeSet({ weightKg: null, reps: 5 })],
      }),
      makeExercise({ position: 1, exerciseId: 2, sets: [makeSet({ weightKg: 50, reps: 5 })] }),
    ],
  });
  const records = computePersonalRecords([bench(1, '2026-01-01T10:00:00Z', [[80, 5]]), w2]);
  expect(records).toEqual([]);
});

test('a set that was never ticked still counts toward records', () => {
  const w2 = makeWorkout({
    lyftaId: 2,
    performedAt: '2026-01-08T10:00:00Z',
    exercises: [makeExercise({ sets: [makeSet({ weightKg: 100, reps: 5, completed: false })] })],
  });
  const records = computePersonalRecords([bench(1, '2026-01-01T10:00:00Z', [[80, 5]]), w2]);
  expect(records.map((rec) => [rec.kind, rec.valueKg])).toEqual([
    ['weight', 100],
    ['e1rm', 100 * (1 + 5 / 30)],
  ]);
});
