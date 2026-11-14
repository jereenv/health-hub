import {
  FORMULA_VERSION,
  bmi,
  bmiHealthyBand,
  bmrKatchMcArdle,
  bmrMifflinStJeor,
  bodyFatBand,
  boneMassKg,
  fatFreeMassSun,
  healthScore,
  impedanceIsUsable,
  metabolicAge,
  proteinPct,
  skeletalMuscleKgJanssen,
  totalBodyWaterKgSun,
  visceralRating,
} from './formulas';
import { computeBodyMetrics } from './computeBodyMetrics';
import { FORMULA_SOURCES } from './sources';

// Synthetic people from the plan; expected values come from the published equations.
const M = { sex: 'male', heightCm: 175, weightKg: 80, impedanceOhm: 500 } as const;
const F = { sex: 'female', heightCm: 165, weightKg: 62, impedanceOhm: 600 } as const;

test('Person M: FFM 59.93, TBW 42.95 kg, SMM 31.36 kg from the Sun and Janssen equations', () => {
  expect(fatFreeMassSun(M)).toBeCloseTo(59.93, 2);
  expect(totalBodyWaterKgSun(M)).toBeCloseTo(42.95, 2);
  expect(skeletalMuscleKgJanssen({ ...M, age: 30 })).toBeCloseTo(31.36, 2);
});

test('Person F: FFM 44.32, TBW 30.84 kg, SMM 20.81 kg', () => {
  expect(fatFreeMassSun(F)).toBeCloseTo(44.32, 2);
  expect(totalBodyWaterKgSun(F)).toBeCloseTo(30.84, 2);
  expect(skeletalMuscleKgJanssen({ ...F, age: 35 })).toBeCloseTo(20.81, 2);
});

test('bmi of M is 26.12 and of F is 22.77', () => {
  expect(bmi(80, 175)).toBeCloseTo(26.12, 2);
  expect(bmi(62, 165)).toBeCloseTo(22.77, 2);
});

test('Katch–McArdle of FFM 59.93 is 1664.5 kcal; of 64 kg lean is 1752.4', () => {
  expect(bmrKatchMcArdle(59.93)).toBeCloseTo(1664.5, 1);
  expect(bmrKatchMcArdle(64)).toBeCloseTo(1752.4, 1);
});

test('Mifflin–St Jeor: M 1748.75, F 1315.25', () => {
  expect(bmrMifflinStJeor({ sex: 'male', weightKg: 80, heightCm: 175, age: 30 })).toBeCloseTo(
    1748.75,
    2,
  );
  expect(bmrMifflinStJeor({ sex: 'female', weightKg: 62, heightCm: 165, age: 35 })).toBeCloseTo(
    1315.25,
    2,
  );
});

test('bone mass is 0.057 of FFM for males and 0.05 for females: M 3.42, F 2.22', () => {
  expect(boneMassKg({ sex: 'male', fatFreeMassKg: fatFreeMassSun(M) })).toBeCloseTo(3.42, 2);
  expect(boneMassKg({ sex: 'female', fatFreeMassKg: fatFreeMassSun(F) })).toBeCloseTo(2.22, 2);
});

test('protein share: M 16.96, F 18.17 (one decimal comparison)', () => {
  const share = (p: typeof M | typeof F) => {
    const ffm = fatFreeMassSun(p);
    return proteinPct({
      fatFreeMassKg: ffm,
      waterKg: totalBodyWaterKgSun(p),
      boneKg: boneMassKg({ sex: p.sex, fatFreeMassKg: ffm }),
      weightKg: p.weightKg,
    });
  };
  expect(share(M)).toBeCloseTo(16.96, 1);
  expect(share(F)).toBeCloseTo(18.17, 1);
});

test('protein share never goes below zero', () => {
  expect(proteinPct({ fatFreeMassKg: 40, waterKg: 45, boneKg: 2, weightKg: 70 })).toBe(0);
});

const bodyFatOf = (p: typeof M | typeof F) => ((p.weightKg - fatFreeMassSun(p)) / p.weightKg) * 100;

test('visceral rating: M 8, F 3; clamps at 1 for a very lean person and at 30 for an extreme one; age adds only beyond 30', () => {
  expect(visceralRating({ sex: 'male', age: 30, bodyFatPct: bodyFatOf(M) })).toBe(8);
  expect(visceralRating({ sex: 'female', age: 35, bodyFatPct: bodyFatOf(F) })).toBe(3);
  expect(visceralRating({ sex: 'male', age: 25, bodyFatPct: 5 })).toBe(1);
  expect(visceralRating({ sex: 'male', age: 90, bodyFatPct: 70 })).toBe(30);
  // 30 and 20 year olds get no age term; 40 adds 1.
  const at = (age: number) => visceralRating({ sex: 'male', age, bodyFatPct: 25 });
  expect(at(20)).toBe(at(30));
  expect(at(40)).toBe(at(30) + 1);
});

test('metabolic age: M 36, F 36; clamps at 18 and 80', () => {
  expect(metabolicAge({ sex: 'male', age: 30, bodyFatPct: bodyFatOf(M) })).toBe(36);
  expect(metabolicAge({ sex: 'female', age: 35, bodyFatPct: bodyFatOf(F) })).toBe(36);
  expect(metabolicAge({ sex: 'male', age: 20, bodyFatPct: 3 })).toBe(18);
  expect(metabolicAge({ sex: 'male', age: 79, bodyFatPct: 60 })).toBe(80);
});

test('health score: M 74, F 100; never below 0 or above 100', () => {
  expect(
    healthScore({
      sex: 'male',
      age: 30,
      bodyFatPct: bodyFatOf(M),
      bmi: 26.12,
      visceral: 8,
      bmiCutoffs: 'who',
    }),
  ).toBe(74);
  expect(
    healthScore({
      sex: 'female',
      age: 35,
      bodyFatPct: bodyFatOf(F),
      bmi: 22.77,
      visceral: 3,
      bmiCutoffs: 'who',
    }),
  ).toBe(100);
  expect(
    healthScore({
      sex: 'male',
      age: 30,
      bodyFatPct: 60,
      bmi: 50,
      visceral: 30,
      bmiCutoffs: 'who',
    }),
  ).toBe(0);
});

test('bodyFatBand returns the Gallagher cut-offs for each sex and age band, using the 20–39 row under 20 and the 60–79 row over 79', () => {
  const band = (sex: 'male' | 'female', age: number) => {
    const b = bodyFatBand(sex, age);
    return [b.healthyFrom, b.slightlyHighFrom, b.highFrom];
  };
  expect(band('male', 26)).toEqual([8, 20, 25]);
  expect(band('male', 45)).toEqual([11, 22, 28]);
  expect(band('male', 65)).toEqual([13, 25, 30]);
  expect(band('female', 30)).toEqual([21, 33, 39]);
  expect(band('female', 40)).toEqual([23, 34, 40]);
  expect(band('female', 60)).toEqual([24, 36, 42]);
  expect(band('male', 15)).toEqual([8, 20, 25]);
  expect(band('female', 85)).toEqual([24, 36, 42]);
  expect(band('male', 39)).toEqual([8, 20, 25]);
});

test('bmiHealthyBand is 18.5–25 for who and 18.5–23 for who_asian', () => {
  expect(bmiHealthyBand('who')).toEqual({ low: 18.5, high: 25 });
  expect(bmiHealthyBand('who_asian')).toEqual({ low: 18.5, high: 23 });
});

test('impedanceIsUsable rejects 150 and 1300 ohm, and a value that gives body fat under 3 or over 60', () => {
  expect(impedanceIsUsable(M)).toBe(true);
  expect(impedanceIsUsable({ ...M, impedanceOhm: 150 })).toBe(false);
  expect(impedanceIsUsable({ ...M, impedanceOhm: 1300 })).toBe(false);
  // In range, but FFM is above body weight (body fat below 3 %).
  expect(impedanceIsUsable({ ...M, weightKg: 50, impedanceOhm: 210 })).toBe(false);
  // In range, but body fat above 60 %.
  expect(impedanceIsUsable({ ...M, weightKg: 300, impedanceOhm: 1200 })).toBe(false);
  expect(impedanceIsUsable({ ...M, impedanceOhm: Number.NaN })).toBe(false);
});

const GOLDEN_ROUND = (value: number | undefined) =>
  value === undefined ? null : Math.round(value * 100) / 100;

test('FORMULA_VERSION golden guard: the full metric set of Person M is pinned', () => {
  // If this fails because a coefficient changed, bump FORMULA_VERSION.
  const metrics = computeBodyMetrics({
    weightKg: 80,
    impedanceOhm: 500,
    legacyBodyFatPct: null,
    heightCm: 175,
    ageYears: 30,
    sex: 'male',
    bmiCutoffs: 'who',
  });
  const rounded = Object.fromEntries(
    Object.entries(metrics).map(([id, metric]) => [id, GOLDEN_ROUND(metric?.value)]),
  );
  expect(FORMULA_VERSION).toBe(1);
  expect(rounded).toEqual({
    weight: 80,
    bmi: 26.12,
    body_fat_pct: 25.08,
    fat_mass_kg: 20.07,
    lean_mass_kg: 59.93,
    water_pct: 53.69,
    muscle_pct: 39.2,
    bmr_kcal: 1664.54,
    visceral_rating: 8,
    bone_mass_kg: 3.42,
    protein_pct: 16.96,
    metabolic_age: 36,
    health_score: 74,
  });
});

test('FORMULA_SOURCES has the ten ids and every entry has a citation and a link', () => {
  expect(FORMULA_SOURCES.map((source) => source.id).sort()).toEqual(
    [
      'sun2003',
      'janssen2000',
      'katchMcArdle',
      'mifflin1990',
      'gallagher2000',
      'who2004',
      'janssen2002',
      'helms2014',
      'openscale',
      'vendor',
    ].sort(),
  );
  for (const source of FORMULA_SOURCES) {
    expect(source.citation.length).toBeGreaterThan(10);
    expect(source.link).toMatch(/^https:\/\//);
  }
});
