import { NEUTRAL_DESCRIPTOR, classify, rangeFor } from './ranges';
import type { RangeContext } from './ranges';
import { METRIC_IDS } from './types';
import type { MetricId } from './types';

const MALE: RangeContext = { sex: 'male', ageYears: 26, heightCm: 175, bmiCutoffs: 'who' };
const FEMALE: RangeContext = { sex: 'female', ageYears: 35, heightCm: 165, bmiCutoffs: 'who' };

function cuts(metric: MetricId, ctx: RangeContext): Array<number | null> {
  const range = rangeFor(metric, ctx);
  if (!range) throw new Error(`no range for ${metric}`);
  return range.bands.slice(1).map((band) => band.from);
}

test('body fat for male 26 has bands 8 / 20 / 25 and source Gallagher', () => {
  const range = rangeFor('body_fat_pct', MALE);
  expect(cuts('body_fat_pct', MALE)).toEqual([8, 20, 25]);
  expect(range?.bands.map((band) => band.label)).toEqual([
    'Low',
    'Healthy',
    'Slightly high',
    'High',
  ]);
  expect(range?.bands.map((band) => band.status)).toEqual(['low', 'ok', 'high', 'high']);
  expect(range?.source).toBe('Gallagher et al., 2000');
  expect(range?.sourceId).toBe('gallagher2000');
  expect([range?.scaleMin, range?.scaleMax]).toEqual([4, 45]);
});

test('body fat bands switch at ages 40 and 60 and for sex, using the 20–39 row under 20', () => {
  expect(cuts('body_fat_pct', { ...MALE, ageYears: 39 })).toEqual([8, 20, 25]);
  expect(cuts('body_fat_pct', { ...MALE, ageYears: 40 })).toEqual([11, 22, 28]);
  expect(cuts('body_fat_pct', { ...MALE, ageYears: 60 })).toEqual([13, 25, 30]);
  expect(cuts('body_fat_pct', { ...MALE, ageYears: 15 })).toEqual([8, 20, 25]);
  expect(cuts('body_fat_pct', FEMALE)).toEqual([21, 33, 39]);
  expect(cuts('body_fat_pct', { ...FEMALE, ageYears: 45 })).toEqual([23, 34, 40]);
});

test('classify puts a boundary value in the upper band: 20 is Slightly high, 8 is Healthy, 25 is High', () => {
  const range = rangeFor('body_fat_pct', MALE);
  if (!range) throw new Error('expected a range');
  expect(classify(range, 20).statusLabel).toBe('Slightly high');
  expect(classify(range, 8).statusLabel).toBe('Healthy');
  expect(classify(range, 25).statusLabel).toBe('High');
  expect(classify(range, 7.99).band.status).toBe('low');
  expect(classify(range, 90).statusLabel).toBe('High');
  expect(classify(range, -5).statusLabel).toBe('Low');
});

test('BMI bands are 18.5 / 25 / 30 for who and 18.5 / 23 / 27.5 for who_asian; BMI 26.1 is Slightly high for who and High for who_asian', () => {
  const who = rangeFor('bmi', MALE);
  const asian = rangeFor('bmi', { ...MALE, bmiCutoffs: 'who_asian' });
  if (!who || !asian) throw new Error('expected ranges');
  expect(cuts('bmi', MALE)).toEqual([18.5, 25, 30]);
  expect(cuts('bmi', { ...MALE, bmiCutoffs: 'who_asian' })).toEqual([18.5, 23, 27.5]);
  expect(classify(who, 26.1).statusLabel).toBe('Slightly high');
  expect(classify(asian, 26.1).statusLabel).toBe('Slightly high');
  expect(classify(asian, 27.5).statusLabel).toBe('High');
  expect(who.source).toBe('WHO (standard cut-offs)');
  expect(asian.source).toBe('WHO (Asian action points)');
  expect([who.scaleMin, who.scaleMax]).toEqual([15, 40]);
});

test('weight bands are the BMI bands converted with the owner height', () => {
  const range = rangeFor('weight', MALE);
  if (!range) throw new Error('expected a range');
  const heightM = 1.75;
  expect(range.bands[1]?.from).toBeCloseTo(18.5 * heightM * heightM, 6);
  expect(range.bands[1]?.to).toBeCloseTo(25 * heightM * heightM, 6);
  expect(range.scaleMin).toBeCloseTo(15 * heightM * heightM, 6);
  expect(range.scaleMax).toBeCloseTo(40 * heightM * heightM, 6);
  expect(classify(range, 80).statusLabel).toBe('Slightly high');
});

test('muscle, water, protein and visceral bands match Ruling 10 for each sex', () => {
  expect(cuts('muscle_pct', MALE)).toEqual([31, 37]);
  expect(cuts('muscle_pct', FEMALE)).toEqual([22, 28]);
  expect(rangeFor('muscle_pct', MALE)?.bands.map((band) => band.label)).toEqual([
    'Very low',
    'Low',
    'Healthy',
  ]);
  expect(rangeFor('muscle_pct', MALE)?.bands.map((band) => band.status)).toEqual([
    'low',
    'low',
    'ok',
  ]);
  expect(rangeFor('muscle_pct', MALE)?.source).toBe('Janssen et al., 2002');
  expect([rangeFor('muscle_pct', MALE)?.scaleMin, rangeFor('muscle_pct', MALE)?.scaleMax]).toEqual([
    20, 55,
  ]);
  expect([
    rangeFor('muscle_pct', FEMALE)?.scaleMin,
    rangeFor('muscle_pct', FEMALE)?.scaleMax,
  ]).toEqual([15, 45]);
  expect(cuts('water_pct', MALE)).toEqual([50, 65]);
  expect(cuts('water_pct', FEMALE)).toEqual([45, 60]);
  expect(cuts('protein_pct', MALE)).toEqual([16, 20]);
  expect(cuts('visceral_rating', MALE)).toEqual([10, 15]);
  expect(rangeFor('visceral_rating', MALE)?.bands.map((band) => band.status)).toEqual([
    'ok',
    'high',
    'high',
  ]);
  expect(rangeFor('water_pct', MALE)?.source).toBe('conventional vendor range');
});

test('metrics without a range return null, and a missing sex, age or height returns null where needed', () => {
  for (const metric of [
    'fat_mass_kg',
    'lean_mass_kg',
    'bmr_kcal',
    'bone_mass_kg',
    'metabolic_age',
    'health_score',
  ] as const) {
    expect(rangeFor(metric, MALE)).toBeNull();
  }
  expect(rangeFor('body_fat_pct', { ...MALE, ageYears: null })).toBeNull();
  expect(rangeFor('weight', { ...MALE, heightCm: null })).toBeNull();
  expect(rangeFor('bmi', { ...MALE, heightCm: null })).not.toBeNull();
});

test('every band list is contiguous, ascending and covers the whole scale', () => {
  for (const ctx of [MALE, FEMALE, { ...MALE, bmiCutoffs: 'who_asian' as const }]) {
    for (const metric of METRIC_IDS) {
      const range = rangeFor(metric, ctx);
      if (!range) continue;
      const { bands } = range;
      expect(bands[0]?.from).toBeNull();
      expect(bands[bands.length - 1]?.to).toBeNull();
      for (let i = 1; i < bands.length; i++) {
        expect(bands[i]?.from).toBe(bands[i - 1]?.to);
        expect(bands[i]?.from as number).toBeGreaterThan(range.scaleMin);
        expect(bands[i]?.from as number).toBeLessThan(range.scaleMax);
      }
      expect(range.scaleMin).toBeLessThan(range.scaleMax);
    }
  }
});

test('NEUTRAL_DESCRIPTOR names the metrics with no range', () => {
  expect(NEUTRAL_DESCRIPTOR).toEqual({
    fat_mass_kg: 'Estimate',
    lean_mass_kg: 'Estimate',
    bmr_kcal: 'Daily baseline',
    bone_mass_kg: 'Estimate',
    metabolic_age: 'For reference',
    health_score: 'For reference',
  });
});
