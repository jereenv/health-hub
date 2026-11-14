import { expectGolden } from '@/test-support/golden';

import { SYNTHETIC_TODAY, syntheticJourney, syntheticWeek } from './__fixtures__/synthetic';
import { setup } from './__fixtures__/views';
import { buildJourneyCsv } from './csv';

const KG_HEADER =
  'date,weight_kg,body_fat_pct,body_fat_source,fat_mass_kg,lean_mass_kg,bmi,bmr_kcal,watch_body_fat_pct,workouts,volume_kg,steps,distance_km,asleep_hours,hr_min,hr_avg,hr_max';
const LB_HEADER =
  'date,weight_lb,body_fat_pct,body_fat_source,fat_mass_lb,lean_mass_lb,bmi,bmr_kcal,watch_body_fat_pct,workouts,volume_lb,steps,distance_mi,asleep_hours,hr_min,hr_avg,hr_max';

function csv(unit: 'kg' | 'lb' = 'kg', data = syntheticJourney()) {
  const { prep, view } = setup(data, 'journey', unit);
  const { content, fileName } = buildJourneyCsv(prep, view);
  const lines = content.split('\n');
  return {
    content,
    fileName,
    header: lines[0]!,
    rows: lines.slice(1, -1).map((l) => l.split(',')),
  };
}

test('header line is exactly the kg header and exactly the lb header for lb', () => {
  expect(csv('kg').header).toBe(KG_HEADER);
  expect(csv('lb').header).toBe(LB_HEADER);
  expect(csv().fileName).toBe('health-hub-journey.csv');
});

test('one row per day from the first day with data to today: 120 rows plus the header', () => {
  const { rows, content } = csv();
  expect(rows).toHaveLength(120);
  expect(rows[0]![0]).toBe('2026-07-16');
  expect(rows[119]![0]).toBe(SYNTHETIC_TODAY);
  expect(content.endsWith('\n')).toBe(true);
  expect(content.endsWith('\n\n')).toBe(false);
});

test('a missing value is an empty cell and never 0: a null-steps day has ,, in the steps column; workouts is 0 and volume empty with none', () => {
  const { rows } = csv();
  // Day index 8 (2026-07-24): steps are null (every 9th day); index 1 has no workout.
  const nullSteps = rows[8]!;
  expect(nullSteps[0]).toBe('2026-07-24');
  expect(nullSteps[11]).toBe('');
  expect(nullSteps[12]).toBe('');
  const noWorkout = rows[1]!;
  expect(noWorkout[9]).toBe('0');
  expect(noWorkout[10]).toBe('');
  const workout = rows[0]!;
  expect(workout[9]).toBe('1');
  expect(workout[10]).not.toBe('');
  // Day index 4 has no weigh-in (every 5th day).
  expect(rows[4]![1]).toBe('');
  expect(rows[4]![2]).toBe('');
});

test("today's steps, distance and heart rate cells are empty", () => {
  const today = csv().rows[119]!;
  expect(today.slice(11, 13)).toEqual(['', '']);
  expect(today.slice(14, 17)).toEqual(['', '', '']);
  // Last night's sleep is complete, so it is kept.
  expect(today[13]).not.toBe('');
});

test('body_fat_source is movinglife for legacy readings; the weight of a day with two readings is the first one', () => {
  expect(csv().rows[0]![3]).toBe('movinglife');
  const week = syntheticWeek();
  const { rows } = csv('kg', week);
  const nov8 = rows.find((r) => r[0] === '2026-11-08')!;
  expect(nov8[1]).toBe('83.8');
  expect(nov8[2]).toBe('23.8');
  expect(nov8[8]).toBe('26.3');
  const nov7 = rows.find((r) => r[0] === '2026-11-07')!;
  expect(nov7[1]).toBe('');
  expect(nov7[3]).toBe('');
});

test('formula readings are marked formula', () => {
  const data = syntheticWeek();
  data.readings = data.readings.map((r) => ({ ...r, impedanceOhm: 500, legacyBodyFatPct: null }));
  expect(csv('kg', data).rows.find((r) => r[0] === '2026-11-09')![3]).toBe('formula');
});

test('lb rows are in pounds and miles', () => {
  const kg = csv('kg', syntheticWeek()).rows.find((r) => r[0] === '2026-11-09')!;
  const lb = csv('lb', syntheticWeek()).rows.find((r) => r[0] === '2026-11-09')!;
  expect(kg[1]).toBe('83.6');
  expect(lb[1]).toBe('184.31');
  expect(kg[12]).toBe('8');
  expect(lb[12]).toBe('4.97');
  expect(kg[10]).toBe('1315');
  expect(lb[10]).toBe('2899.08');
});

test('every row has the same number of fields as the header and no field contains a quote or newline', () => {
  const { content, rows, header } = csv();
  expect(rows.every((row) => row.length === header.split(',').length)).toBe(true);
  expect(content).not.toContain('"');
  expect(content).not.toMatch(/\r|NaN|undefined|Infinity/);
  for (const row of rows) {
    for (const cell of row.slice(1))
      expect(cell).toMatch(/^-?\d+(\.\d{1,2})?$|^$|^(formula|movinglife)$/);
  }
});

test('journey.csv golden', () => {
  expectGolden('journey.csv', csv().content);
});
