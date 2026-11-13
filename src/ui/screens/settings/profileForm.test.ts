import { LB_TO_KG } from '@/domain/format/units';
import type { Profile } from '@/domain/profile/profile';

import { formToProfileInput, profileToForm } from './profileForm';
import type { ProfileForm } from './profileForm';

const TODAY = '2026-11-10';
const BLANK: ProfileForm = {
  height: '',
  birthDate: '',
  sex: null,
  goalWeight: '',
  bmiCutoffs: 'who',
};

test('blank profile fields become null', () => {
  expect(formToProfileInput(BLANK, 'kg', TODAY)).toEqual({
    input: { heightCm: null, birthDate: null, sex: null, goalWeightKg: null, bmiCutoffs: 'who' },
    errors: [],
  });
});

test('goal weight typed in lb is stored in kg', () => {
  const { input, errors } = formToProfileInput({ ...BLANK, goalWeight: '172' }, 'lb', TODAY);
  expect(input.goalWeightKg).toBeCloseTo(172 * LB_TO_KG, 10);
  expect(errors).toEqual([]);
});

test('accepts a comma decimal', () => {
  const { input } = formToProfileInput({ ...BLANK, goalWeight: '82,5' }, 'kg', TODAY);
  expect(input.goalWeightKg).toBe(82.5);
});

test('reports an invalid height and a malformed birth date', () => {
  const { errors } = formToProfileInput(
    { ...BLANK, height: '17x', birthDate: '12/03/1995' },
    'kg',
    TODAY,
  );
  expect(errors).toEqual(['height', 'birthDate']);
});

const SAVED: Profile = {
  heightCm: 180,
  birthDate: '1995-03-12',
  sex: 'male',
  goalWeightKg: 78,
  bmiCutoffs: 'who_asian',
  effectiveFrom: '2026-10-01T00:00:00.000Z',
};

test('a saved profile round-trips through the form', () => {
  const form = profileToForm(SAVED, 'kg');
  expect(form).toEqual({
    height: '180',
    birthDate: '1995-03-12',
    sex: 'male',
    goalWeight: '78',
    bmiCutoffs: 'who_asian',
  });
  expect(formToProfileInput(form, 'kg', TODAY, SAVED).input).toEqual({
    heightCm: 180,
    birthDate: '1995-03-12',
    sex: 'male',
    goalWeightKg: 78,
    bmiCutoffs: 'who_asian',
  });
});

test('saving an unchanged goal weight in lb keeps the stored kg', () => {
  const form = profileToForm(SAVED, 'lb');
  expect(form.goalWeight).toBe('172');
  expect(formToProfileInput(form, 'lb', TODAY, SAVED).input.goalWeightKg).toBe(78);
});

test('an empty form for no saved profile shows blanks and WHO ranges', () => {
  expect(profileToForm(null, 'kg')).toEqual(BLANK);
});
