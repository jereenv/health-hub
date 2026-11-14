import type { BodyReading } from '@/data/body/BodyRepository';
import type { Profile } from '@/domain/profile/profile';

import { computeReadings, missingProfileFields, profileAt } from './readings';

function version(effectiveFrom: string, overrides: Partial<Profile> = {}): Profile {
  return {
    heightCm: 175,
    birthDate: '1996-11-15',
    sex: 'male',
    goalWeightKg: null,
    bmiCutoffs: 'who',
    effectiveFrom,
    ...overrides,
  };
}

function reading(
  id: number,
  measuredAt: string,
  overrides: Partial<BodyReading> = {},
): BodyReading {
  return {
    id,
    measuredAt,
    weightKg: 80,
    impedanceOhm: 500,
    source: 'ble',
    legacyBodyFatPct: null,
    ...overrides,
  };
}

test('profileAt picks the latest version at or before the reading, else the earliest, else null', () => {
  const versions = [
    version('2026-01-01T00:00:00.000Z', { heightCm: 170 }),
    version('2026-06-01T00:00:00.000Z', { heightCm: 175 }),
  ];
  expect(profileAt(versions, '2026-03-01T00:00:00.000Z')?.heightCm).toBe(170);
  expect(profileAt(versions, '2026-06-01T00:00:00.000Z')?.heightCm).toBe(175);
  expect(profileAt(versions, '2030-01-01T00:00:00.000Z')?.heightCm).toBe(175);
  expect(profileAt(versions, '2020-01-01T00:00:00.000Z')?.heightCm).toBe(170);
  expect(profileAt([], '2026-03-01T00:00:00.000Z')).toBeNull();
});

test('age is computed on the reading day: the day before a birthday is one year younger', () => {
  const versions = [version('2026-01-01T00:00:00.000Z', { birthDate: '1996-11-15' })];
  // Midday UTC is the same calendar day in New York (the test zone).
  const [before, on] = computeReadings(
    [reading(1, '2026-11-14T17:00:00.000Z'), reading(2, '2026-11-15T17:00:00.000Z')],
    versions,
  );
  // Visceral rating adds 0.1 per year over 30, so a one-year difference is visible through the
  // pinned legacy-free metric set only via metabolic age's age term.
  expect(before?.metrics.metabolic_age?.value).toBe((on?.metrics.metabolic_age?.value ?? 0) - 1);
});

test('computeReadings applies the profile in effect at each reading', () => {
  const versions = [
    version('2026-01-01T00:00:00.000Z', { heightCm: 160 }),
    version('2026-06-01T00:00:00.000Z', { heightCm: 180 }),
  ];
  const [early, late] = computeReadings(
    [reading(1, '2026-03-01T12:00:00.000Z'), reading(2, '2026-09-01T12:00:00.000Z')],
    versions,
  );
  expect(early?.metrics.bmi?.value).toBeCloseTo(80 / 1.6 ** 2, 6);
  expect(late?.metrics.bmi?.value).toBeCloseTo(80 / 1.8 ** 2, 6);
});

test('a reading near local midnight gets the local date, including across the 2026-11-01 DST change', () => {
  const [a, b, c, d] = computeReadings(
    [
      // EDT (UTC-4) until 2026-11-01 02:00 local, EST (UTC-5) after.
      reading(1, '2026-11-01T03:30:00.000Z'), // 23:30 on Oct 31 EDT
      reading(2, '2026-11-01T04:30:00.000Z'), // 00:30 on Nov 1 EDT
      reading(3, '2026-11-02T04:30:00.000Z'), // 23:30 on Nov 1 EST
      reading(4, '2026-11-02T05:30:00.000Z'), // 00:30 on Nov 2 EST
    ],
    [],
  );
  expect([a?.date, b?.date, c?.date, d?.date]).toEqual([
    '2026-10-31',
    '2026-11-01',
    '2026-11-01',
    '2026-11-02',
  ]);
});

test('missingProfileFields lists height, birthDate and sex only when null', () => {
  expect(missingProfileFields(null)).toEqual(['height', 'birthDate', 'sex']);
  expect(missingProfileFields(version('2026-01-01T00:00:00.000Z'))).toEqual([]);
  expect(
    missingProfileFields(version('2026-01-01T00:00:00.000Z', { heightCm: null, birthDate: null })),
  ).toEqual(['height', 'birthDate']);
  expect(missingProfileFields(version('2026-01-01T00:00:00.000Z', { sex: null }))).toEqual(['sex']);
});

test('with no profile at all every reading still yields weight', () => {
  const result = computeReadings([reading(1, '2026-03-01T12:00:00.000Z')], []);
  expect(Object.keys(result[0]?.metrics ?? {})).toEqual(['weight']);
});
