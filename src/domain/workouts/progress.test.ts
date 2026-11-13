import { makeExercise, makeSet, makeWorkout } from '@/test-support/workoutBuilders';

import { buildExerciseProgress } from './progress';

const TODAY = '2026-11-12';

function session(lyftaId: number, performedAt: string, weightKg: number, reps = 5, name = 'Bench') {
  return makeWorkout({
    lyftaId,
    performedAt,
    exercises: [makeExercise({ exerciseId: 1, name, sets: [makeSet({ weightKg, reps })] })],
  });
}

const HISTORY = [
  session(1, '2026-06-01T15:00:00.000Z', 120, 1, 'Old Bench'),
  session(2, '2026-10-20T15:00:00.000Z', 80),
  session(3, '2026-11-10T15:00:00.000Z', 90, 3, 'Bench Press'),
];

test('returns null for an exercise never performed', () => {
  expect(buildExerciseProgress(HISTORY, 99, 'week', TODAY)).toBeNull();
});

test('day range keeps only sessions from the last 30 days', () => {
  const progress = buildExerciseProgress(HISTORY, 1, 'day', TODAY)!;
  expect(progress.e1rmSeries.map((p) => p.start)).toEqual(['2026-10-20', '2026-11-10']);
  expect(progress.volumeSeries.map((p) => p.value)).toEqual([400, 270]);
});

test('week range zero-fills volume but not e1RM', () => {
  const progress = buildExerciseProgress(HISTORY, 1, 'week', TODAY)!;
  expect(progress.e1rmSeries.map((p) => p.start)).toEqual(['2026-10-19', '2026-11-09']);
  expect(progress.volumeSeries).toHaveLength(12);
  expect(progress.volumeSeries.filter((p) => p.value === 0)).toHaveLength(10);
  expect(progress.volumeSeries[11]).toMatchObject({ start: '2026-11-09', value: 270 });
});

test('month range covers every month since the first session', () => {
  const progress = buildExerciseProgress(HISTORY, 1, 'month', TODAY)!;
  expect(progress.volumeSeries.map((p) => p.start)).toEqual([
    '2026-06-01',
    '2026-07-01',
    '2026-08-01',
    '2026-09-01',
    '2026-10-01',
    '2026-11-01',
  ]);
  expect(progress.e1rmSeries).toHaveLength(3);
});

test('best weight and e1RM come from all history, not the range', () => {
  const progress = buildExerciseProgress(HISTORY, 1, 'day', TODAY)!;
  expect(progress.bestWeight).toEqual({ kg: 120, date: '2026-06-01' });
  expect(progress.bestE1rm).toEqual({ kg: 120, date: '2026-06-01', weightKg: 120, reps: 1 });
  expect(progress.sessions).toBe(3);
  expect(progress.lastDate).toBe('2026-11-10');
});

test('uses the latest exercise name and lists recent sessions newest first', () => {
  const progress = buildExerciseProgress(HISTORY, 1, 'week', TODAY)!;
  expect(progress.name).toBe('Bench Press');
  expect(progress.recent.map((s) => s.lyftaId)).toEqual([3, 2, 1]);
});

test('an exercise without scored sets has no bests and empty series', () => {
  const workouts = [
    makeWorkout({
      lyftaId: 1,
      performedAt: '2026-11-10T15:00:00.000Z',
      exercises: [makeExercise({ exerciseId: 1, sets: [makeSet({ weightKg: null, reps: null })] })],
    }),
  ];
  const progress = buildExerciseProgress(workouts, 1, 'week', TODAY)!;
  expect(progress.bestWeight).toBeNull();
  expect(progress.bestE1rm).toBeNull();
  expect(progress.e1rmSeries).toEqual([]);
});
