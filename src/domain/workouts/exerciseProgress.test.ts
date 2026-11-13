import { makeExercise, makeSet, makeWorkout } from '@/test-support/workoutBuilders';
import { exerciseSessions } from './exerciseProgress';

describe('exerciseSessions', () => {
  test('exerciseSessions merges repeated entries in one workout and skips other exercises', () => {
    const workouts = [
      makeWorkout({
        lyftaId: 2,
        performedAt: '2026-11-10T15:00:00.000Z',
        exercises: [
          makeExercise({
            position: 0,
            exerciseId: 1,
            name: 'Bench',
            sets: [makeSet({ weightKg: 60, reps: 10 })],
          }),
          makeExercise({
            position: 1,
            exerciseId: 2,
            name: 'Squat',
            sets: [makeSet({ weightKg: 100, reps: 5 })],
          }),
          makeExercise({
            position: 2,
            exerciseId: 1,
            name: 'Bench',
            sets: [makeSet({ weightKg: 70, reps: 5 })],
          }),
        ],
      }),
      makeWorkout({
        lyftaId: 1,
        performedAt: '2026-11-03T15:00:00.000Z',
        exercises: [
          makeExercise({
            exerciseId: 1,
            name: 'Bench Press',
            sets: [makeSet({ weightKg: 50, reps: 1 })],
          }),
        ],
      }),
      makeWorkout({
        lyftaId: 3,
        performedAt: '2026-11-11T15:00:00.000Z',
        exercises: [makeExercise({ exerciseId: 2, sets: [makeSet()] })],
      }),
    ];
    const sessions = exerciseSessions(workouts, 1);
    expect(sessions.map((s) => s.lyftaId)).toEqual([1, 2]);
    expect(sessions[0]).toMatchObject({
      date: '2026-11-03',
      name: 'Bench Press',
      scoredSets: 1,
      volumeKg: 50,
      bestWeightKg: 50,
      bestE1rmKg: 50,
      topSet: { weightKg: 50, reps: 1 },
    });
    expect(sessions[1]).toMatchObject({
      performedAt: '2026-11-10T15:00:00.000Z',
      name: 'Bench',
      scoredSets: 2,
      volumeKg: 950,
      bestWeightKg: 70,
      topSet: { weightKg: 70, reps: 5 },
    });
    expect(sessions[1]?.bestE1rmKg).toBeCloseTo(70 * (1 + 5 / 30), 5);
    expect(sessions[0]?.e1rmSet).toEqual({ weightKg: 50, reps: 1 });
    expect(sessions[1]?.e1rmSet).toEqual({ weightKg: 70, reps: 5 });
  });

  test('exerciseSessions top set prefers heavier, then more reps, then the earliest set', () => {
    const sets = (spec: [number, number][]) =>
      spec.map(([weightKg, reps], position) => makeSet({ position, weightKg, reps }));
    const [a, b, c] = [
      makeWorkout({
        lyftaId: 1,
        performedAt: '2026-11-01T15:00:00.000Z',
        exercises: [
          makeExercise({
            sets: sets([
              [80, 5],
              [90, 3],
              [90, 4],
              [85, 8],
            ]),
          }),
        ],
      }),
      makeWorkout({
        lyftaId: 2,
        performedAt: '2026-11-02T15:00:00.000Z',
        exercises: [
          makeExercise({
            sets: sets([
              [90, 3],
              [90, 3],
            ]),
          }),
        ],
      }),
      makeWorkout({
        lyftaId: 3,
        performedAt: '2026-11-03T15:00:00.000Z',
        exercises: [
          makeExercise({
            sets: [
              makeSet({ position: 1, weightKg: 90, reps: 3 }),
              makeSet({ position: 0, weightKg: 90, reps: 3, rir: 2 }),
            ],
          }),
        ],
      }),
    ];
    const sessions = exerciseSessions([a!, b!, c!], 1);
    expect(sessions[0]?.topSet).toEqual({ weightKg: 90, reps: 4 });
    expect(sessions[1]?.topSet).toEqual({ weightKg: 90, reps: 3 });
    expect(sessions[0]?.bestWeightKg).toBe(90);
  });

  test('a session without scored sets still appears with nulls and zeros', () => {
    const workout = makeWorkout({
      lyftaId: 1,
      performedAt: '2026-11-01T15:00:00.000Z',
      exercises: [
        makeExercise({ sets: [makeSet({ completed: false }), makeSet({ weightKg: null })] }),
      ],
    });
    expect(exerciseSessions([workout], 1)).toEqual([
      {
        lyftaId: 1,
        performedAt: '2026-11-01T15:00:00.000Z',
        date: '2026-11-01',
        name: 'Bench Press',
        scoredSets: 0,
        volumeKg: 0,
        bestWeightKg: null,
        bestE1rmKg: null,
        e1rmSet: null,
        topSet: null,
      },
    ]);
  });

  test('bestE1rmKg is null when every scored set is beyond the Epley rep limit', () => {
    const workout = makeWorkout({
      lyftaId: 1,
      performedAt: '2026-11-01T15:00:00.000Z',
      exercises: [makeExercise({ sets: [makeSet({ weightKg: 20, reps: 20 })] })],
    });
    expect(exerciseSessions([workout], 1)[0]).toMatchObject({
      scoredSets: 1,
      bestWeightKg: 20,
      bestE1rmKg: null,
    });
  });

  test('sessions are oldest first with lyftaId breaking ties', () => {
    const at = '2026-11-01T15:00:00.000Z';
    const mk = (lyftaId: number) =>
      makeWorkout({ lyftaId, performedAt: at, exercises: [makeExercise({ sets: [makeSet()] })] });
    expect(exerciseSessions([mk(7), mk(3)], 1).map((s) => s.lyftaId)).toEqual([3, 7]);
  });
});
