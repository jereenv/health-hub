import { makeExercise, makeSet, makeWorkout } from '@/test-support/workoutBuilders';

import { buildWorkoutDetail } from './detail';
import { prSetKey } from './records';

const workout = makeWorkout({
  lyftaId: 7,
  performedAt: '2026-11-10T15:00:00.000Z',
  title: 'Push',
  durationS: 3000,
  exercises: [
    makeExercise({
      position: 0,
      exerciseId: 1,
      name: 'Bench Press',
      sets: [
        makeSet({ position: 0, weightKg: 100, reps: 5 }),
        makeSet({ position: 1, weightKg: 60, reps: 10, completed: false }),
      ],
    }),
    makeExercise({
      position: 1,
      exerciseId: 2,
      name: 'Plank',
      sets: [makeSet({ position: 0, weightKg: null, reps: null })],
    }),
  ],
});

test('marks PR sets and counts each PR set once', () => {
  // A set that is a record in both weight and 1-rep max has one key, so it counts once.
  const detail = buildWorkoutDetail(workout, new Set([prSetKey(7, 0, 0)]));
  expect(detail.prCount).toBe(1);
  expect(detail.exercises[0]!.sets.map((s) => s.isPr)).toEqual([true, false]);
  expect(detail.exercises[1]!.sets.map((s) => s.isPr)).toEqual([false]);
});

test('exercise meta counts scored sets and their volume', () => {
  const [bench, plank] = buildWorkoutDetail(workout, new Set()).exercises;
  expect(bench).toMatchObject({ scoredSets: 1, volumeKg: 500, name: 'Bench Press', exerciseId: 1 });
  expect(plank).toMatchObject({ scoredSets: 0, volumeKg: 0 });
});

test('counts every exercise and set, including sets not done', () => {
  const detail = buildWorkoutDetail(workout, new Set());
  expect(detail).toMatchObject({
    lyftaId: 7,
    title: 'Push',
    date: '2026-11-10',
    durationS: 3000,
    volumeKg: 500,
    exerciseCount: 2,
    setCount: 3,
  });
});
