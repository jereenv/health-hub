import { makeExercise, makeSet, makeWorkout } from '@/test-support/workoutBuilders';

import {
  estimateOneRepMaxKg,
  exerciseVolumeKg,
  isScoredSet,
  scoredSetCount,
  setVolumeKg,
  workoutVolumeKg,
} from './metrics';

describe('estimateOneRepMaxKg', () => {
  test.each([
    [90, 3, 99],
    [100, 1, 100],
    [80, 12, 112],
    [80, 13, null],
    [80, 0, null],
  ])('estimateOneRepMaxKg(%p, %p) = %p', (w, r, e) => {
    const v = estimateOneRepMaxKg(w, r);
    if (e === null) expect(v).toBeNull();
    else expect(v).toBeCloseTo(e, 9);
  });
});

describe('volume', () => {
  const sets = [
    makeSet({ position: 0, weightKg: 80, reps: 5, completed: false }),
    makeSet({ position: 1, weightKg: null, reps: 5 }),
    makeSet({ position: 2, weightKg: 0, reps: 10 }),
    makeSet({ position: 3, weightKg: 80, reps: null }),
    makeSet({ position: 4, weightKg: 80, reps: 5 }),
    makeSet({ position: 5, weightKg: -5, reps: 5 }),
    makeSet({ position: 6, weightKg: 80, reps: 2.5 }),
  ];

  test('sets without weight or whole reps never count, ticked or not', () => {
    const exercise = makeExercise({ sets });
    const workout = makeWorkout({
      lyftaId: 1,
      performedAt: '2026-01-01T10:00:00Z',
      exercises: [exercise],
    });
    expect(workoutVolumeKg(workout)).toBe(800);
    expect(exerciseVolumeKg(exercise)).toBe(800);
    expect(scoredSetCount(exercise)).toBe(3);
    expect(sets.map(isScoredSet)).toEqual([true, false, true, false, true, false, false]);
    expect(sets.map(setVolumeKg)).toEqual([400, 0, 0, 0, 400, 0, 0]);
  });

  test('workout volume sums every exercise', () => {
    const workout = makeWorkout({
      lyftaId: 1,
      performedAt: '2026-01-01T10:00:00Z',
      exercises: [
        makeExercise({ position: 0, sets: [makeSet({ weightKg: 100, reps: 3 })] }),
        makeExercise({ position: 1, exerciseId: 2, sets: [makeSet({ weightKg: 50, reps: 10 })] }),
      ],
    });
    expect(workoutVolumeKg(workout)).toBe(800);
  });
});
