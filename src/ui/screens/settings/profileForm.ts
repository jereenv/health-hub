import { formatWeightNumber, unitToKg } from '@/domain/format/units';
import type {
  BmiCutoffs,
  Profile,
  ProfileError,
  ProfileInput,
  Sex,
} from '@/domain/profile/profile';
import { validateProfile } from '@/domain/profile/profile';
import type { DateKey } from '@/domain/time/localDate';
import type { WeightUnit } from '@/domain/workouts/types';

/** The profile as the owner types it: text for numbers and dates, weight in the display unit. */
export interface ProfileForm {
  height: string;
  birthDate: string;
  sex: Sex | null;
  goalWeight: string;
  bmiCutoffs: BmiCutoffs;
}

export function profileToForm(profile: Profile | null, unit: WeightUnit): ProfileForm {
  return {
    height: profile?.heightCm == null ? '' : String(profile.heightCm),
    birthDate: profile?.birthDate ?? '',
    sex: profile?.sex ?? null,
    goalWeight: profile?.goalWeightKg == null ? '' : formatWeightNumber(profile.goalWeightKg, unit),
    bmiCutoffs: profile?.bmiCutoffs ?? 'who',
  };
}

/** Blank is null; a comma decimal is accepted; anything unreadable is NaN, which validation rejects. */
function parseNumber(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;
  return /^\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : NaN;
}

/**
 * `current` is the saved profile. While the goal-weight text still equals what the saved value
 * displays as, the stored kg is kept, so opening and saving in lb never adds a profile version.
 */
export function formToProfileInput(
  form: ProfileForm,
  unit: WeightUnit,
  today: DateKey,
  current: Profile | null = null,
): { input: ProfileInput; errors: ProfileError[] } {
  const typedGoal = parseNumber(form.goalWeight);
  const savedGoalKg = current?.goalWeightKg ?? null;
  const goalUnchanged =
    savedGoalKg !== null && form.goalWeight.trim() === formatWeightNumber(savedGoalKg, unit);
  const input: ProfileInput = {
    heightCm: parseNumber(form.height),
    birthDate: form.birthDate.trim() === '' ? null : form.birthDate.trim(),
    sex: form.sex,
    goalWeightKg: goalUnchanged
      ? savedGoalKg
      : typedGoal === null
        ? null
        : unitToKg(typedGoal, unit),
    bmiCutoffs: form.bmiCutoffs,
  };
  return { input, errors: validateProfile(input, today) };
}
