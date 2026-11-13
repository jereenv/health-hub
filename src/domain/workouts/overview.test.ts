import { makeExercise, makeSet, makeWorkout } from '@/test-support/workoutBuilders';

import { buildWorkoutsOverview } from './overview';
import { computePersonalRecords } from './records';
import type { ScheduledWorkout } from './schedule';
import type { Workout } from './types';

// Thursday 12 Nov 2026; this week starts Monday 9 Nov (New York time).
const TODAY = '2026-11-12';

function bench(
  lyftaId: number,
  performedAt: string,
  weightKg: number,
  extra: Partial<Workout> = {},
) {
  return makeWorkout({
    lyftaId,
    performedAt,
    title: `W${lyftaId}`,
    durationS: 3600,
    exercises: [
      makeExercise({ exerciseId: 1, sets: [makeSet({ position: 0, weightKg, reps: 5 })] }),
    ],
    ...extra,
  });
}

function overview(workouts: Workout[], upcoming: ScheduledWorkout[] = []) {
  return buildWorkoutsOverview({
    workouts,
    upcoming,
    records: computePersonalRecords(workouts),
    today: TODAY,
  });
}

function planned(
  lyftaId: string,
  date: string,
  title: string,
  completed = false,
): ScheduledWorkout {
  return { lyftaId, date, title, templateId: null, source: null, status: null, completed };
}

test('empty history gives an empty overview with zeroed week stats', () => {
  const result = overview([]);
  expect(result.thisWeek).toEqual({ sessions: 0, volumeKg: 0, durationS: null });
  expect(result.latest).toBeNull();
  expect(result.latestPrCount).toBe(0);
  expect(result.topLift).toBeNull();
  expect(result.weeks).toEqual([]);
  expect(result.weeklyVolume).toHaveLength(8);
});

test("this week's totals include the latest workout", () => {
  const result = overview([
    bench(1, '2026-11-09T15:00:00.000Z', 100),
    bench(2, '2026-11-11T15:00:00.000Z', 80),
  ]);
  expect(result.thisWeek).toEqual({ sessions: 2, volumeKg: 900, durationS: 7200 });
});

test('the latest workout is excluded from rows and labels its week Earlier this week', () => {
  const result = overview([
    bench(1, '2026-11-09T15:00:00.000Z', 100),
    bench(2, '2026-11-11T15:00:00.000Z', 80),
    bench(3, '2026-11-04T15:00:00.000Z', 60),
    bench(4, '2026-10-20T15:00:00.000Z', 60),
  ]);
  expect(result.latest?.lyftaId).toBe(2);
  expect(result.weeks.map((w) => [w.label, w.rows.map((r) => r.lyftaId), w.sessions])).toEqual([
    ['earlier_this_week', [1], 2],
    ['last_week', [3], 1],
    ['range', [4], 1],
  ]);
});

test('a week holding only the latest workout is dropped from the list', () => {
  const result = overview([bench(1, '2026-11-11T15:00:00.000Z', 80)]);
  expect(result.weeks).toEqual([]);
  expect(result.thisWeek.sessions).toBe(1);
});

test('weekly volume has 8 zero-filled weeks ending this week', () => {
  const result = overview([bench(1, '2026-11-11T15:00:00.000Z', 80)]);
  expect(result.weeklyVolume.map((p) => p.start)).toEqual([
    '2026-09-21',
    '2026-09-28',
    '2026-10-05',
    '2026-10-12',
    '2026-10-19',
    '2026-10-26',
    '2026-11-02',
    '2026-11-09',
  ]);
  expect(result.weeklyVolume.map((p) => p.value)).toEqual([0, 0, 0, 0, 0, 0, 0, 400]);
});

test('counts the PR sets of the latest workout', () => {
  const result = overview([
    bench(1, '2026-11-04T15:00:00.000Z', 60),
    bench(2, '2026-11-11T15:00:00.000Z', 80),
  ]);
  // The set beats the old best in weight and in estimated 1-rep max: one set, so one PR.
  expect(result.latestPrCount).toBe(1);
});

test('top lift is the most frequent exercise of the last 56 days, with change since its first session there', () => {
  const squat = (lyftaId: number, performedAt: string, weightKg: number) =>
    makeWorkout({
      lyftaId,
      performedAt,
      exercises: [
        makeExercise({
          exerciseId: 1,
          name: 'Bench Press',
          sets: [makeSet({ weightKg: 60, reps: 5 })],
        }),
        makeExercise({
          position: 1,
          exerciseId: 2,
          name: 'Squat',
          sets: [makeSet({ weightKg, reps: 1 })],
        }),
      ],
    });
  const result = overview([
    makeWorkout({
      lyftaId: 9,
      performedAt: '2026-08-01T15:00:00.000Z',
      exercises: [
        makeExercise({ exerciseId: 2, name: 'Squat', sets: [makeSet({ weightKg: 500, reps: 1 })] }),
      ],
    }),
    squat(1, '2026-10-01T15:00:00.000Z', 100),
    squat(2, '2026-10-15T15:00:00.000Z', 110),
    squat(3, '2026-11-10T15:00:00.000Z', 120),
    makeWorkout({
      lyftaId: 4,
      performedAt: '2026-11-11T15:00:00.000Z',
      exercises: [makeExercise({ exerciseId: 1, sets: [makeSet({ weightKg: 70, reps: 5 })] })],
    }),
  ]);
  // Bench has 4 sessions in the window and squat 3, so bench wins.
  expect(result.topLift?.exerciseId).toBe(1);
  expect(result.topLift?.series).toHaveLength(4);
  expect(result.topLift?.since).toBe('2026-10-01');
  expect(result.topLift?.deltaKg).toBeCloseTo(70 * (1 + 5 / 30) - 60 * (1 + 5 / 30), 6);
});

test('top lift ties go to the exercise trained most recently, and single sessions have no change', () => {
  const result = overview([
    makeWorkout({
      lyftaId: 1,
      performedAt: '2026-11-10T15:00:00.000Z',
      exercises: [makeExercise({ exerciseId: 1, name: 'Bench Press', sets: [makeSet()] })],
    }),
    makeWorkout({
      lyftaId: 2,
      performedAt: '2026-11-11T15:00:00.000Z',
      exercises: [makeExercise({ exerciseId: 2, name: 'Squat', sets: [makeSet()] })],
    }),
  ]);
  expect(result.topLift).toMatchObject({
    exerciseId: 2,
    name: 'Squat',
    deltaKg: null,
    since: null,
  });
});

test('upcoming keeps only future, uncompleted items, soonest first, at most 5', () => {
  const items = [
    planned('a', '2026-11-20', 'Late'),
    planned('b', '2026-11-11', 'Past'),
    planned('c', '2026-11-12', 'Today'),
    planned('d', '2026-11-13', 'Done', true),
    ...['e', 'f', 'g', 'h', 'i'].map((id, i) => planned(id, `2026-11-${14 + i}`, `Day ${id}`)),
  ];
  const result = overview([], items).upcoming;
  expect(result.map((i) => i.lyftaId)).toEqual(['c', 'e', 'f', 'g', 'h']);
});
