import { PROFILE_LIMITS, type Sex } from '@/domain/profile/profile';
import { ageOn, type DateKey } from '@/domain/time/localDate';
import { CMD } from './protocol';
import { encodeFrame } from './frameCodec';

const DEFAULT_HEIGHT_CM = 175;
const DEFAULT_AGE_YEARS = 30;
const MAX_U16 = 0xffff;

export interface ScaleProfileInput {
  sex: Sex | null;
  heightCm: number | null;
  birthDate: DateKey | null;
  lastWeightKg: number | null;
  today: DateKey;
}

function within(value: number, [min, max]: readonly [number, number]): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

/** The 0x01 user-profile frame the scale expects before it measures (Ruling 3). */
export function encodeProfile(input: ScaleProfileInput, userId: number): number[] {
  const sex = input.sex === 'female' ? 0x00 : 0x01;
  const height = input.heightCm === null ? Number.NaN : Math.round(input.heightCm);
  const age = input.birthDate === null ? Number.NaN : ageOn(input.birthDate, input.today);
  const lastWeight =
    input.lastWeightKg === null || !Number.isFinite(input.lastWeightKg)
      ? 0
      : Math.min(MAX_U16, Math.max(0, Math.round(input.lastWeightKg * 10)));
  return encodeFrame(CMD.PROFILE, [
    0x00,
    0x00,
    (userId >> 8) & 0xff,
    userId & 0xff,
    sex,
    within(height, PROFILE_LIMITS.heightCm) ? height : DEFAULT_HEIGHT_CM,
    within(age, PROFILE_LIMITS.ageYears) ? age : DEFAULT_AGE_YEARS,
    0x00,
    0x00,
    (lastWeight >> 8) & 0xff,
    lastWeight & 0xff,
  ]);
}
