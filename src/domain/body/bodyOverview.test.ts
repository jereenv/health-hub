import type { BodyReading } from '@/data/body/BodyRepository';
import type { Profile } from '@/domain/profile/profile';

import { allWeighIns, buildBodyOverview } from './bodyOverview';
import { computeReadings } from './readings';

const TODAY = '2026-11-13';

// Person M: male, 175 cm, born 1996-01-01 (age 30 on the dates below).
const PROFILE: Profile = {
  heightCm: 175,
  birthDate: '1996-01-01',
  sex: 'male',
  goalWeightKg: null,
  bmiCutoffs: 'who',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
};

function reading(
  id: number,
  date: string,
  weightKg: number,
  extra: Partial<BodyReading> = {},
): BodyReading {
  return {
    id,
    measuredAt: `${date}T12:00:00.000Z`,
    weightKg,
    impedanceOhm: null,
    source: 'health_connect',
    legacyBodyFatPct: null,
    ...extra,
  };
}

const impedance = (id: number, date: string, weightKg = 80) =>
  reading(id, date, weightKg, { impedanceOhm: 500, source: 'ble' });
const legacy = (id: number, date: string, weightKg: number, bodyFat = 20) =>
  reading(id, date, weightKg, { legacyBodyFatPct: bodyFat });

function overview(readings: BodyReading[], profile: Profile | null = PROFILE) {
  return buildBodyOverview(computeReadings(readings, profile ? [profile] : []), profile, TODAY);
}

test('rows list only the metrics the latest reading has, in the Body page order', () => {
  const { rows } = overview([impedance(1, '2026-11-12')]);
  expect(rows.map((r) => r.id)).toEqual([
    'body_fat_pct',
    'muscle_pct',
    'water_pct',
    'bmi',
    'bmr_kcal',
    'visceral_rating',
    'bone_mass_kg',
    'metabolic_age',
    'lean_mass_kg',
    'fat_mass_kg',
    'protein_pct',
    'health_score',
  ]);
});

test('a legacy-only latest reading gives body fat, BMI, BMR, lean and fat mass rows and onlyLegacy true', () => {
  const result = overview([legacy(1, '2026-11-12', 80)]);
  expect(result.rows.map((r) => r.id)).toEqual([
    'body_fat_pct',
    'bmi',
    'bmr_kcal',
    'lean_mass_kg',
    'fat_mass_kg',
  ]);
  expect(result.onlyLegacy).toBe(true);
});

test('an impedance reading gives all twelve rows', () => {
  const result = overview([impedance(1, '2026-11-12')]);
  expect(result.rows).toHaveLength(12);
  expect(result.onlyLegacy).toBe(false);
});

test('status label and tone come from the profile in effect at the latest reading', () => {
  const young = overview([legacy(1, '2026-11-12', 80, 22)]);
  expect(young.rows[0]).toMatchObject({
    id: 'body_fat_pct',
    statusLabel: 'Slightly high',
    statusTone: 'high',
  });
  // Female 20-39 band: 22 % is Healthy.
  const female = overview([legacy(1, '2026-11-12', 80, 22)], { ...PROFILE, sex: 'female' });
  expect(female.rows[0]).toMatchObject({ statusLabel: 'Healthy', statusTone: 'ok' });
});

test('metrics without a range carry a neutral descriptor and no tone', () => {
  const lean = overview([legacy(1, '2026-11-12', 80)]).rows.find((r) => r.id === 'lean_mass_kg');
  expect(lean).toMatchObject({ statusLabel: null, statusTone: null, descriptor: 'Estimate' });
  const bmr = overview([legacy(1, '2026-11-12', 80)]).rows.find((r) => r.id === 'bmr_kcal');
  expect(bmr?.descriptor).toBe('Daily baseline');
});

test('weightChange30 and weightSpark cover the last 30 days only', () => {
  const result = overview([
    reading(1, '2026-09-01', 90),
    reading(2, '2026-10-20', 85),
    reading(3, '2026-11-12', 83),
  ]);
  expect(result.weightSpark).toEqual([85, 83]);
  expect(result.weightChange30).toBeCloseTo(-2);
});

test('recent holds 4 newest-first rows and allWeighIns holds every reading', () => {
  const readings = [1, 2, 3, 4, 5, 6].map((n) => reading(n, `2026-11-0${n}`, 80 + n));
  const computed = computeReadings(readings, [PROFILE]);
  const result = buildBodyOverview(computed, PROFILE, TODAY);
  expect(result.recent.map((r) => r.readingId)).toEqual([6, 5, 4, 3]);
  expect(allWeighIns(computed).map((r) => r.readingId)).toEqual([6, 5, 4, 3, 2, 1]);
});

test('bodyFatHollow is true for legacy body fat', () => {
  const result = overview([legacy(1, '2026-11-10', 80), impedance(2, '2026-11-12')]);
  expect(result.recent.map((r) => r.bodyFatHollow)).toEqual([false, true]);
  expect(result.recent[1]?.bodyFatPct).toBe(20);
});

test('missing lists the absent profile fields and an absent profile lists all three', () => {
  expect(overview([reading(1, '2026-11-12', 80)], { ...PROFILE, birthDate: null }).missing).toEqual(
    ['birthDate'],
  );
  expect(overview([reading(1, '2026-11-12', 80)], null).missing).toEqual([
    'height',
    'birthDate',
    'sex',
  ]);
});

test('no readings gives a null latest and empty lists', () => {
  const result = overview([]);
  expect(result).toMatchObject({
    latest: null,
    weightChange30: null,
    weightSpark: [],
    rows: [],
    lossRate: null,
    fatVsLean: null,
    recent: [],
    onlyLegacy: false,
  });
});

test('a profile saved after the latest weigh-in changes the banner and ranges immediately', () => {
  const oldProfile: Profile = { ...PROFILE, birthDate: null };
  const newProfile: Profile = {
    ...PROFILE,
    effectiveFrom: '2026-11-13T09:00:00.000Z',
  };
  const readings = computeReadings([legacy(1, '2026-11-12', 80, 22)], [oldProfile, newProfile]);
  const before = buildBodyOverview(readings, oldProfile, TODAY);
  expect(before.missing).toEqual(['birthDate']);
  expect(before.rows[0]).toMatchObject({ id: 'body_fat_pct', statusLabel: null });
  const after = buildBodyOverview(readings, newProfile, TODAY);
  expect(after.missing).toEqual([]);
  expect(after.rows[0]).toMatchObject({ statusLabel: 'Slightly high', statusTone: 'high' });
});
