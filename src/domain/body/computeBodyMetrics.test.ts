import { computeBodyMetrics } from './computeBodyMetrics';
import { METRIC_IDS, METRIC_META, isLegacyOrigin } from './types';
import type { BodyInput, MetricId } from './types';

const PERSON_M: BodyInput = {
  weightKg: 80,
  impedanceOhm: 500,
  legacyBodyFatPct: 20,
  heightCm: 175,
  ageYears: 30,
  sex: 'male',
  bmiCutoffs: 'who',
};

const value = (metrics: ReturnType<typeof computeBodyMetrics>, id: MetricId) => metrics[id]?.value;

test('Person M with impedance returns all 13 metrics; weight is measured/scale, bmi exact, FFM-based ones estimated/formula, the last five rough', () => {
  const metrics = computeBodyMetrics(PERSON_M);
  expect(Object.keys(metrics).sort()).toEqual([...METRIC_IDS].sort());
  expect(metrics.weight).toEqual({ value: 80, tier: 'measured', origin: 'scale' });
  expect(metrics.bmi).toMatchObject({ tier: 'exact', origin: 'formula' });
  for (const id of [
    'body_fat_pct',
    'fat_mass_kg',
    'lean_mass_kg',
    'water_pct',
    'muscle_pct',
    'bmr_kcal',
  ] as const) {
    expect(metrics[id]).toMatchObject({ tier: 'estimated', origin: 'formula' });
  }
  for (const id of [
    'visceral_rating',
    'bone_mass_kg',
    'protein_pct',
    'metabolic_age',
    'health_score',
  ] as const) {
    expect(metrics[id]).toMatchObject({ tier: 'rough', origin: 'formula' });
  }
});

test('Person M body fat is 25.08 and lean mass 59.93 with origin formula', () => {
  const metrics = computeBodyMetrics(PERSON_M);
  expect(value(metrics, 'body_fat_pct')).toBeCloseTo(25.08, 2);
  expect(value(metrics, 'lean_mass_kg')).toBeCloseTo(59.93, 2);
  expect(metrics.lean_mass_kg?.origin).toBe('formula');
  expect(value(metrics, 'visceral_rating')).toBe(8);
  expect(value(metrics, 'metabolic_age')).toBe(36);
  expect(value(metrics, 'health_score')).toBe(74);
});

test('legacy only (M, impedance null, bf 20): body fat 20 origin movinglife, fat 16 and lean 64 origin movinglife_derived, BMR 1752.4 origin movinglife_derived, no water, muscle, bone, protein, visceral, age or score', () => {
  const metrics = computeBodyMetrics({ ...PERSON_M, impedanceOhm: null });
  expect(metrics.body_fat_pct).toEqual({ value: 20, tier: 'estimated', origin: 'movinglife' });
  expect(metrics.fat_mass_kg).toMatchObject({ origin: 'movinglife_derived' });
  expect(value(metrics, 'fat_mass_kg')).toBeCloseTo(16, 6);
  expect(metrics.lean_mass_kg).toMatchObject({ origin: 'movinglife_derived' });
  expect(value(metrics, 'lean_mass_kg')).toBeCloseTo(64, 6);
  expect(value(metrics, 'bmr_kcal')).toBeCloseTo(1752.4, 1);
  expect(metrics.bmr_kcal?.origin).toBe('movinglife_derived');
  for (const id of [
    'water_pct',
    'muscle_pct',
    'bone_mass_kg',
    'protein_pct',
    'visceral_rating',
    'metabolic_age',
    'health_score',
  ] as const) {
    expect(metrics[id]).toBeUndefined();
  }
  expect(isLegacyOrigin('movinglife')).toBe(true);
  expect(isLegacyOrigin('movinglife_derived')).toBe(true);
  expect(isLegacyOrigin('formula')).toBe(false);
});

test('no impedance and no body fat: weight, bmi and Mifflin BMR only', () => {
  const metrics = computeBodyMetrics({ ...PERSON_M, impedanceOhm: null, legacyBodyFatPct: null });
  expect(Object.keys(metrics).sort()).toEqual(['bmi', 'bmr_kcal', 'weight']);
  expect(value(metrics, 'bmr_kcal')).toBeCloseTo(1748.75, 2);
  expect(metrics.bmr_kcal?.origin).toBe('formula');
});

test('an unusable impedance falls back to the legacy value, and to BMI plus Mifflin when there is none', () => {
  const withLegacy = computeBodyMetrics({ ...PERSON_M, impedanceOhm: 150 });
  expect(withLegacy.body_fat_pct?.origin).toBe('movinglife');
  const without = computeBodyMetrics({ ...PERSON_M, impedanceOhm: 150, legacyBodyFatPct: null });
  expect(Object.keys(without).sort()).toEqual(['bmi', 'bmr_kcal', 'weight']);
});

test('impedance wins when both impedance and a legacy value exist', () => {
  const metrics = computeBodyMetrics(PERSON_M);
  expect(metrics.body_fat_pct?.origin).toBe('formula');
  expect(value(metrics, 'body_fat_pct')).not.toBe(20);
});

test('missing height removes bmi, FFM and everything built on them; missing age removes muscle, Mifflin, visceral, metabolic age and health score; missing sex is covered by its own test below', () => {
  const noHeight = computeBodyMetrics({ ...PERSON_M, heightCm: null });
  expect(noHeight.bmi).toBeUndefined();
  // Falls back to the legacy value, since the impedance cannot be used without a height.
  expect(noHeight.body_fat_pct?.origin).toBe('movinglife');
  expect(noHeight.water_pct).toBeUndefined();
  const noHeightNoLegacy = computeBodyMetrics({
    ...PERSON_M,
    heightCm: null,
    legacyBodyFatPct: null,
  });
  expect(Object.keys(noHeightNoLegacy)).toEqual(['weight']);

  const noAge = computeBodyMetrics({ ...PERSON_M, ageYears: null });
  for (const id of ['muscle_pct', 'visceral_rating', 'metabolic_age', 'health_score'] as const) {
    expect(noAge[id]).toBeUndefined();
  }
  expect(noAge.water_pct).toBeDefined();
  const noAgeNoImpedance = computeBodyMetrics({
    ...PERSON_M,
    ageYears: null,
    impedanceOhm: null,
    legacyBodyFatPct: null,
  });
  expect(noAgeNoImpedance.bmr_kcal).toBeUndefined();
});

test('a legacy body fat of 0, 100, NaN or negative is ignored', () => {
  for (const bad of [0, 100, Number.NaN, -5]) {
    const metrics = computeBodyMetrics({ ...PERSON_M, impedanceOhm: null, legacyBodyFatPct: bad });
    expect(metrics.body_fat_pct).toBeUndefined();
    expect(metrics.bmr_kcal?.origin).toBe('formula');
  }
});

test('output never contains NaN or Infinity for zero or negative weight', () => {
  for (const weightKg of [0, -3, Number.NaN]) {
    expect(computeBodyMetrics({ ...PERSON_M, weightKg })).toEqual({});
  }
  for (const metric of Object.values(computeBodyMetrics(PERSON_M))) {
    expect(Number.isFinite(metric?.value)).toBe(true);
  }
});

test('Person F with impedance gives the pinned female values', () => {
  const metrics = computeBodyMetrics({
    weightKg: 62,
    impedanceOhm: 600,
    legacyBodyFatPct: 30,
    heightCm: 165,
    ageYears: 35,
    sex: 'female',
    bmiCutoffs: 'who',
  });
  expect(value(metrics, 'lean_mass_kg')).toBeCloseTo(44.32, 2);
  expect(value(metrics, 'visceral_rating')).toBe(3);
  expect(value(metrics, 'health_score')).toBe(100);
});

test('METRIC_IDS has the 13 ids in order, each with metadata', () => {
  expect(METRIC_IDS).toHaveLength(13);
  expect(METRIC_IDS[0]).toBe('weight');
  expect(METRIC_IDS[12]).toBe('health_score');
  for (const id of METRIC_IDS) expect(METRIC_META[id].label.length).toBeGreaterThan(0);
});

test('without a sex a legacy reading still gets weight, BMI, MovingLife body fat, fat and lean mass and Katch-McArdle BMR', () => {
  const metrics = computeBodyMetrics({ ...PERSON_M, sex: null });
  expect(Object.keys(metrics).sort()).toEqual(
    ['weight', 'bmi', 'body_fat_pct', 'fat_mass_kg', 'lean_mass_kg', 'bmr_kcal'].sort(),
  );
  expect(metrics.body_fat_pct?.origin).toBe('movinglife');
  expect(value(metrics, 'bmr_kcal')).toBeCloseTo(1752.4, 1);
  const noLegacy = computeBodyMetrics({ ...PERSON_M, sex: null, legacyBodyFatPct: null });
  expect(Object.keys(noLegacy).sort()).toEqual(['bmi', 'weight']);
});
