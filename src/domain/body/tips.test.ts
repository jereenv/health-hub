import { tipFor } from './tips';
import type { TipInput } from './tips';
import { METRIC_IDS } from './types';

const BASE: TipInput = {
  metric: 'body_fat_pct',
  band: null,
  bandLabel: null,
  change30: null,
  goalWeightKg: null,
  latestWeightKg: null,
};

const tip = (overrides: Partial<TipInput>) => tipFor({ ...BASE, ...overrides });

test('each row of the tip table fires on its condition and returns the exact copy', () => {
  expect(tip({ metric: 'body_fat_pct', band: 'high', change30: -0.3 })).toBe(
    'Down {x} points in 30 days, a steady pace. Keep protein high so the loss stays mostly fat.',
  );
  expect(tip({ metric: 'body_fat_pct', band: 'high', change30: -0.2 })).toBe(
    'Body fat is above your range. A modest calorie deficit with regular lifting is the reliable route.',
  );
  expect(tip({ metric: 'body_fat_pct', band: 'high' })).toBe(
    'Body fat is above your range. A modest calorie deficit with regular lifting is the reliable route.',
  );
  expect(tip({ metric: 'body_fat_pct', band: 'low' })).toBe(
    'Body fat is below your range. Make sure you are eating enough to train and recover.',
  );
  expect(tip({ metric: 'muscle_pct', band: 'low' })).toBe(
    'Muscle share is below the usual range. Lifting and enough protein are the levers.',
  );
  expect(tip({ metric: 'muscle_pct', band: 'ok', change30: -1 })).toBe(
    'Muscle share is falling. Keep lifting and protein up while you lose weight.',
  );
  expect(tip({ metric: 'water_pct', band: 'low' })).toBe(
    'A low reading is often hydration. Drink water, then weigh again in similar conditions.',
  );
  expect(tip({ metric: 'water_pct', band: 'high' })).toBe(
    'A high reading is usually salt or a recent big drink. Compare with your 7-day trend.',
  );
  expect(tip({ metric: 'visceral_rating', band: 'high' })).toBe(
    'Visceral fat falls mainly as your overall body fat falls.',
  );
  expect(tip({ metric: 'protein_pct', band: 'low' })).toBe(
    'Protein share is below the usual range. Check your daily protein intake.',
  );
  expect(tip({ metric: 'bmi', band: 'high' })).toBe(
    'BMI does not separate muscle from fat. Check body fat before drawing conclusions.',
  );
  expect(tip({ metric: 'weight', goalWeightKg: 70, latestWeightKg: 80, change30: 0.5 })).toBe(
    'Weight is up {x} in 30 days while your goal is lower. Check the week-to-week trend.',
  );
});

test('no tip for healthy values, for null band, or for rough metrics other than visceral and protein', () => {
  expect(tip({ metric: 'body_fat_pct', band: 'ok' })).toBeNull();
  expect(tip({ metric: 'body_fat_pct', band: null })).toBeNull();
  expect(tip({ metric: 'bmi', band: 'ok' })).toBeNull();
  expect(tip({ metric: 'water_pct', band: 'ok' })).toBeNull();
  expect(tip({ metric: 'muscle_pct', band: 'ok', change30: -0.9 })).toBeNull();
  expect(tip({ metric: 'visceral_rating', band: 'ok' })).toBeNull();
  expect(tip({ metric: 'protein_pct', band: 'high' })).toBeNull();
  for (const metric of [
    'bone_mass_kg',
    'metabolic_age',
    'health_score',
    'fat_mass_kg',
    'lean_mass_kg',
    'bmr_kcal',
  ] as const) {
    expect(tip({ metric, band: 'high', change30: -5 })).toBeNull();
  }
  // Weight needs a goal, a weight above it and a real rise.
  expect(tip({ metric: 'weight', goalWeightKg: null, latestWeightKg: 80, change30: 1 })).toBeNull();
  expect(tip({ metric: 'weight', goalWeightKg: 85, latestWeightKg: 80, change30: 1 })).toBeNull();
  expect(tip({ metric: 'weight', goalWeightKg: 70, latestWeightKg: 80, change30: 0.4 })).toBeNull();
  expect(
    tip({ metric: 'weight', goalWeightKg: 70, latestWeightKg: 80, change30: null }),
  ).toBeNull();
  expect(METRIC_IDS.every((metric) => tip({ metric }) === null)).toBe(true);
});

test('first matching rule wins when two apply', () => {
  expect(tip({ metric: 'muscle_pct', band: 'low', change30: -2 })).toBe(
    'Muscle share is below the usual range. Lifting and enough protein are the levers.',
  );
  expect(tip({ metric: 'body_fat_pct', band: 'high', change30: -1 })).toMatch(/^Down \{x\} points/);
});
