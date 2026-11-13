import { ageOn, isDateKey, type DateKey } from '@/domain/time/localDate';

export type Sex = 'female' | 'male';
export type BmiCutoffs = 'who' | 'who_asian';

/** The owner's body profile as of `effectiveFrom`; height is always centimetres, weight kilograms. */
export interface Profile {
  heightCm: number | null;
  birthDate: DateKey | null;
  sex: Sex | null;
  goalWeightKg: number | null;
  bmiCutoffs: BmiCutoffs;
  /** ISO-8601 UTC instant from which this version applies. */
  effectiveFrom: string;
}

export type ProfileInput = Omit<Profile, 'effectiveFrom'>;
export type ProfileError = 'height' | 'birthDate' | 'goalWeight';

/** Inclusive bounds. */
export const PROFILE_LIMITS = {
  heightCm: [100, 250],
  ageYears: [13, 100],
  goalWeightKg: [30, 300],
} as const;

function outside(value: number, [min, max]: readonly [number, number]): boolean {
  return !Number.isFinite(value) || value < min || value > max;
}

function birthDateIsInvalid(birthDate: string, today: DateKey): boolean {
  // DateKeys are zero-padded, so string order is calendar order.
  if (!isDateKey(birthDate) || birthDate > today) return true;
  return outside(ageOn(birthDate, today), PROFILE_LIMITS.ageYears);
}

/** Returns each failing field once, in the order height, birthDate, goalWeight. Null fields are valid. */
export function validateProfile(input: ProfileInput, today: DateKey): ProfileError[] {
  const errors: ProfileError[] = [];
  if (input.heightCm !== null && outside(input.heightCm, PROFILE_LIMITS.heightCm)) {
    errors.push('height');
  }
  if (input.birthDate !== null && birthDateIsInvalid(input.birthDate, today)) {
    errors.push('birthDate');
  }
  if (input.goalWeightKg !== null && outside(input.goalWeightKg, PROFILE_LIMITS.goalWeightKg)) {
    errors.push('goalWeight');
  }
  return errors;
}
