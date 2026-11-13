import { PROFILE_LIMITS, validateProfile, type ProfileInput } from './profile';

const TODAY = '2026-11-13';

function input(overrides: Partial<ProfileInput> = {}): ProfileInput {
  return {
    heightCm: 175,
    birthDate: '1990-06-15',
    sex: 'female',
    goalWeightKg: 70,
    bmiCutoffs: 'who',
    ...overrides,
  };
}

test('accepts a complete valid profile and an empty one', () => {
  expect(validateProfile(input(), TODAY)).toEqual([]);
  expect(
    validateProfile(
      { heightCm: null, birthDate: null, sex: null, goalWeightKg: null, bmiCutoffs: 'who' },
      TODAY,
    ),
  ).toEqual([]);
});

test('rejects height outside 100–250 cm and accepts the bounds', () => {
  expect(PROFILE_LIMITS.heightCm).toEqual([100, 250]);
  expect(validateProfile(input({ heightCm: 99.9 }), TODAY)).toEqual(['height']);
  expect(validateProfile(input({ heightCm: 250.1 }), TODAY)).toEqual(['height']);
  expect(validateProfile(input({ heightCm: Number.NaN }), TODAY)).toEqual(['height']);
  expect(validateProfile(input({ heightCm: Number.POSITIVE_INFINITY }), TODAY)).toEqual(['height']);
  expect(validateProfile(input({ heightCm: 100 }), TODAY)).toEqual([]);
  expect(validateProfile(input({ heightCm: 250 }), TODAY)).toEqual([]);
});

test('rejects a future, under-13, over-100 or impossible birth date', () => {
  expect(validateProfile(input({ birthDate: '2026-11-14' }), TODAY)).toEqual(['birthDate']);
  expect(validateProfile(input({ birthDate: '2013-11-14' }), TODAY)).toEqual(['birthDate']);
  expect(validateProfile(input({ birthDate: '1925-11-13' }), TODAY)).toEqual(['birthDate']);
  expect(validateProfile(input({ birthDate: '2026-02-30' }), TODAY)).toEqual(['birthDate']);
  expect(validateProfile(input({ birthDate: 'not a date' }), TODAY)).toEqual(['birthDate']);
});

test('accepts birth dates giving exactly age 13 and exactly age 100', () => {
  expect(validateProfile(input({ birthDate: '2013-11-13' }), TODAY)).toEqual([]);
  expect(validateProfile(input({ birthDate: '1926-11-13' }), TODAY)).toEqual([]);
});

test('rejects goal weight outside 30–300 kg and accepts the bounds', () => {
  expect(validateProfile(input({ goalWeightKg: 29.9 }), TODAY)).toEqual(['goalWeight']);
  expect(validateProfile(input({ goalWeightKg: 300.1 }), TODAY)).toEqual(['goalWeight']);
  expect(validateProfile(input({ goalWeightKg: Number.NaN }), TODAY)).toEqual(['goalWeight']);
  expect(validateProfile(input({ goalWeightKg: 30 }), TODAY)).toEqual([]);
  expect(validateProfile(input({ goalWeightKg: 300 }), TODAY)).toEqual([]);
});

test('reports every error once, in field order', () => {
  expect(
    validateProfile(input({ goalWeightKg: 1, birthDate: '2026-02-30', heightCm: 5 }), TODAY),
  ).toEqual(['height', 'birthDate', 'goalWeight']);
});
