import type { BodyReading } from '@/data/body/BodyRepository';
import type { Profile } from '@/domain/profile/profile';
import type { DateKey } from '@/domain/time/localDate';
import { ageOn, localDateKey } from '@/domain/time/localDate';

import { computeBodyMetrics } from './computeBodyMetrics';
import type { BodyMetrics } from './types';

/**
 * The profile in effect at `iso`: the latest version at or before it, else the earliest, else
 * null. Same rule as ProfileRepository.getAt. `versions` must be ascending (as listVersions
 * returns them); both sides are our own ISO UTC strings, so string order is time order.
 */
export function profileAt(versions: readonly Profile[], iso: string): Profile | null {
  let inEffect: Profile | null = null;
  for (const version of versions) {
    if (version.effectiveFrom <= iso) inEffect = version;
  }
  return inEffect ?? versions[0] ?? null;
}

export interface ReadingMetrics {
  id: number;
  measuredAt: string;
  /** The reading's day in the phone's zone. */
  date: DateKey;
  metrics: BodyMetrics;
}

/** Every reading's metrics, computed with the profile in effect at its time. Ascending as given. */
export function computeReadings(
  readings: readonly BodyReading[],
  versions: readonly Profile[],
): ReadingMetrics[] {
  return readings.map((reading) => {
    const date = localDateKey(reading.measuredAt);
    const profile = profileAt(versions, reading.measuredAt);
    const metrics = computeBodyMetrics({
      weightKg: reading.weightKg,
      impedanceOhm: reading.impedanceOhm,
      legacyBodyFatPct: reading.legacyBodyFatPct,
      heightCm: profile?.heightCm ?? null,
      ageYears: profile?.birthDate ? ageOn(profile.birthDate, date) : null,
      sex: profile?.sex ?? null,
      bmiCutoffs: profile?.bmiCutoffs ?? 'who',
    });
    return { id: reading.id, measuredAt: reading.measuredAt, date, metrics };
  });
}

/** Which profile fields the Body tab still needs (Ruling 9). */
export function missingProfileFields(
  profile: Profile | null,
): Array<'height' | 'birthDate' | 'sex'> {
  const missing: Array<'height' | 'birthDate' | 'sex'> = [];
  if (profile?.heightCm == null) missing.push('height');
  if (profile?.birthDate == null) missing.push('birthDate');
  if (profile?.sex == null) missing.push('sex');
  return missing;
}
