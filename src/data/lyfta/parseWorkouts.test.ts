import { LyftaError } from './LyftaError';
import { LB_TO_KG, parseWorkoutPage } from './parseWorkouts';

const sandbox = require('./__fixtures__/sandbox-workouts.json');

test('parses the sandbox page in kg', () => {
  const page = parseWorkoutPage(sandbox, 'kg');
  expect(page).toMatchObject({ skipped: 0, currentPage: 1, totalPages: 1 });
  const upper = page.workouts[0].workout;
  expect(upper).toMatchObject({
    lyftaId: 1001,
    title: 'Upper Strength',
    performedAt: '2026-08-20T17:05:00.000Z',
    totalVolumeKg: 12400,
    bodyWeightKg: 82,
  });
  expect(upper.exercises[0]).toMatchObject({
    position: 0,
    exerciseId: 2,
    name: 'Bench Press',
    exerciseType: 'weight_reps',
    restTimeS: 180,
  });
  expect(upper.exercises[0].sets).toEqual([
    {
      position: 0,
      weightKg: 80,
      reps: 5,
      rir: 2,
      duration: null,
      distance: null,
      setType: '1',
      completed: true,
    },
    {
      position: 1,
      weightKg: 90,
      reps: 3,
      rir: 1,
      duration: null,
      distance: null,
      setType: '1',
      completed: true,
    },
  ]);
  expect(JSON.parse(page.workouts[0].rawJson).id).toBe(1001);
});

test('converts pounds to kilograms', () => {
  const set = parseWorkoutPage(sandbox, 'lb').workouts[0].workout.exercises[0].sets[0];
  expect(set.weightKg).toBeCloseTo(80 * LB_TO_KG, 6);
});

test('converts body weight and total volume from pounds to kilograms', () => {
  const workout = parseWorkoutPage(sandbox, 'lb').workouts[0].workout;
  expect(workout.bodyWeightKg).toBeCloseTo(82 * LB_TO_KG, 6);
  expect(workout.totalVolumeKg).toBeCloseTo(12400 * LB_TO_KG, 6);
});

test('leaves body weight and total volume unchanged in kilograms', () => {
  const workout = parseWorkoutPage(sandbox, 'kg').workouts[0].workout;
  expect(workout.bodyWeightKg).toBe(82);
  expect(workout.totalVolumeKg).toBe(12400);
});

test('parses empty and non-numeric strings as null', () => {
  const json = structuredClone(sandbox);
  Object.assign(json.workouts[0].exercises[0].sets[0], { weight: '', reps: 'abc', rir: '' });
  const set = parseWorkoutPage(json, 'kg').workouts[0].workout.exercises[0].sets[0];
  expect(set).toMatchObject({ weightKg: null, reps: null, rir: null });
});

test('skips invalid workouts and counts them', () => {
  const json = structuredClone(sandbox);
  json.workouts[1].workout_perform_date = 'not a date';
  const page = parseWorkoutPage(json, 'kg');
  expect(page.workouts.map((w) => w.workout.lyftaId)).toEqual([1001]);
  expect(page.skipped).toBe(1);
});

test('treats a workout without exercises as empty', () => {
  const json = structuredClone(sandbox);
  delete json.workouts[0].exercises;
  expect(parseWorkoutPage(json, 'kg').workouts[0].workout.exercises).toEqual([]);
});

test('rejects a response without a workouts array', () => {
  expect(() => parseWorkoutPage({}, 'kg')).toThrow(
    expect.objectContaining({ kind: 'invalid_response' }),
  );
});

test('LyftaError keeps instanceof and its fields', () => {
  const error = new LyftaError('rate_limited', 'slow down', 429);
  expect(error).toBeInstanceOf(LyftaError);
  expect(error).toBeInstanceOf(Error);
  expect(error).toMatchObject({ name: 'LyftaError', kind: 'rate_limited', status: 429 });
});
