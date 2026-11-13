import { LyftaError } from './LyftaError';
import {
  LB_TO_KG,
  WORKOUT_PARSER_VERSION,
  parseWorkoutPage,
  parseWorkoutRecord,
} from './parseWorkouts';

const sandbox = require('./__fixtures__/sandbox-workouts.json');

test('parses the sandbox page in kg', () => {
  const page = parseWorkoutPage(sandbox, 'kg');
  expect(page).toMatchObject({ skipped: 0, currentPage: 1, totalPages: 1 });
  const upper = page.workouts[0].workout;
  expect(upper).toMatchObject({
    lyftaId: 1001,
    title: 'Upper Strength',
    performedAt: '2026-08-20T17:05:00.000Z',
    durationS: null,
  });
  expect(upper).not.toHaveProperty('totalVolumeKg');
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

test('ignores the hand-entered body weight', () => {
  const workout = parseWorkoutPage(sandbox, 'kg').workouts[0].workout;
  expect(workout).not.toHaveProperty('bodyWeightKg');
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

test('the parser version is 2', () => {
  expect(WORKOUT_PARSER_VERSION).toBe(2);
});

test('reads workout_duration into durationS', () => {
  const json = structuredClone(sandbox);
  json.workouts[0].workout_duration = '02:06:49';
  const page = parseWorkoutPage(json, 'kg');
  expect(page.workouts[0].workout.durationS).toBe(7609);
  expect(page.workouts[1].workout.durationS).toBeNull();
});

test('an unparseable workout_duration becomes null without skipping the workout', () => {
  const json = structuredClone(sandbox);
  json.workouts[0].workout_duration = 'soon';
  const page = parseWorkoutPage(json, 'kg');
  expect(page.skipped).toBe(0);
  expect(page.workouts[0].workout.durationS).toBeNull();
});

test('reads zoneless perform dates as local New York time', () => {
  const json = structuredClone(sandbox);
  json.workouts[0].workout_perform_date = '2026-08-20 13:05:00';
  expect(parseWorkoutPage(json, 'kg').workouts[0].workout.performedAt).toBe(
    '2026-08-20T17:05:00.000Z',
  );
});

test('a workout weight_unit overrides the account unit for set weights', () => {
  const json = structuredClone(sandbox);
  json.workouts[0].weight_unit = 'kg';
  const set = parseWorkoutPage(json, 'lb').workouts[0].workout.exercises[0].sets[0];
  expect(set.weightKg).toBe(80);
});

test('an unrecognised workout weight_unit falls back to the account unit', () => {
  const json = structuredClone(sandbox);
  json.workouts[0].weight_unit = 'stone';
  const set = parseWorkoutPage(json, 'lb').workouts[0].workout.exercises[0].sets[0];
  expect(set.weightKg).toBeCloseTo(80 * LB_TO_KG, 6);
});

test('keeps an exercise whose id is a numeric string', () => {
  const json = structuredClone(sandbox);
  json.workouts[0].exercises[0].exercise_id = '2';
  expect(parseWorkoutPage(json, 'kg').workouts[0].workout.exercises[0].exerciseId).toBe(2);
});

test('drops an exercise without an id but keeps the workout', () => {
  const json = structuredClone(sandbox);
  const before = json.workouts[0].exercises.length;
  delete json.workouts[0].exercises[0].exercise_id;
  const page = parseWorkoutPage(json, 'kg');
  expect(page.skipped).toBe(0);
  expect(page.workouts[0].workout.exercises).toHaveLength(before - 1);
});

test('drops a non-object set entry', () => {
  const json = structuredClone(sandbox);
  const before = json.workouts[0].exercises[0].sets.length;
  json.workouts[0].exercises[0].sets.push('oops', null, 7);
  expect(parseWorkoutPage(json, 'kg').workouts[0].workout.exercises[0].sets).toHaveLength(before);
});

test('missing title, exercise name and type get placeholders', () => {
  const json = structuredClone(sandbox);
  delete json.workouts[0].title;
  delete json.workouts[0].exercises[0].excercise_name;
  delete json.workouts[0].exercises[0].exercise_type;
  const workout = parseWorkoutPage(json, 'kg').workouts[0].workout;
  expect(workout.title).toBe('Workout');
  expect(workout.exercises[0]).toMatchObject({ name: 'Exercise', exerciseType: 'unknown' });
});

test('a missing is_completed means not completed', () => {
  const json = structuredClone(sandbox);
  delete json.workouts[0].exercises[0].sets[0].is_completed;
  expect(parseWorkoutPage(json, 'kg').workouts[0].workout.exercises[0].sets[0].completed).toBe(
    false,
  );
});

test('a garbage body_weight or total_volume never skips a workout', () => {
  const json = structuredClone(sandbox);
  json.workouts[0].body_weight = { nested: ['garbage'] };
  json.workouts[0].total_volume = 'lots';
  const page = parseWorkoutPage(json, 'kg');
  expect(page.skipped).toBe(0);
  expect(page.workouts[0].workout.lyftaId).toBe(1001);
  expect(JSON.parse(page.workouts[0].rawJson).body_weight).toEqual({ nested: ['garbage'] });
});

test('accepts a numeric string workout id and skips a workout without a usable id', () => {
  const json = structuredClone(sandbox);
  json.workouts[0].id = '1001';
  delete json.workouts[1].id;
  const page = parseWorkoutPage(json, 'kg');
  expect(page.workouts.map((w) => w.workout.lyftaId)).toEqual([1001]);
  expect(page.skipped).toBe(1);
});

test('parseWorkoutRecord returns null for an invalid workout', () => {
  expect(parseWorkoutRecord(null, 'kg')).toBeNull();
  expect(parseWorkoutRecord('x', 'kg')).toBeNull();
  expect(parseWorkoutRecord({ id: 1 }, 'kg')).toBeNull();
  expect(parseWorkoutRecord({ id: 1, workout_perform_date: 'nope' }, 'kg')).toBeNull();
  expect(parseWorkoutRecord({ workout_perform_date: '2026-08-20 13:05:00' }, 'kg')).toBeNull();
});

test('a workout with only an id and a date parses with defaults', () => {
  const parsed = parseWorkoutRecord({ id: 5, workout_perform_date: '2026-08-20 13:05:00' }, 'kg');
  expect(parsed?.workout).toEqual({
    lyftaId: 5,
    performedAt: '2026-08-20T17:05:00.000Z',
    title: 'Workout',
    durationS: null,
    exercises: [],
  });
});

test('parseWorkoutRecord parses one workout and keeps its raw JSON', () => {
  const parsed = parseWorkoutRecord(sandbox.workouts[0], 'kg');
  expect(parsed?.workout.lyftaId).toBe(1001);
  expect(JSON.parse(parsed?.rawJson ?? '{}').id).toBe(1001);
});

test('the page exposes total_records', () => {
  expect(parseWorkoutPage(sandbox, 'kg').totalRecords).toBe(2);
  const text = { ...structuredClone(sandbox), total_records: '31' };
  expect(parseWorkoutPage(text, 'kg').totalRecords).toBe(31);
  const absent = structuredClone(sandbox);
  delete absent.total_records;
  expect(parseWorkoutPage(absent, 'kg').totalRecords).toBeNull();
});
