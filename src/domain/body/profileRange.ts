import type { Profile } from '@/domain/profile/profile';
import type { DateKey } from '@/domain/time/localDate';
import { ageOn } from '@/domain/time/localDate';

import { rangeFor } from './ranges';
import type { MetricRange } from './ranges';
import type { MetricId } from './types';

/** Metrics whose range does not depend on the person's sex. */
const SEX_FREE: readonly MetricId[] = ['weight', 'bmi', 'protein_pct', 'visceral_rating'];

/**
 * The range for a metric from a profile, as of `on`. Null when the profile lacks something the
 * range needs (Ruling 9): the app shows no range rather than guessing one.
 */
export function rangeForProfile(
  metric: MetricId,
  profile: Profile | null,
  on: DateKey,
): MetricRange | null {
  if (profile === null) return null;
  const sex = profile.sex ?? (SEX_FREE.includes(metric) ? 'male' : null);
  if (sex === null) return null;
  return rangeFor(metric, {
    sex,
    ageYears: profile.birthDate === null ? null : ageOn(profile.birthDate, on),
    heightCm: profile.heightCm,
    bmiCutoffs: profile.bmiCutoffs,
  });
}
