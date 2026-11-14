import type { Profile } from '@/domain/profile/profile';
import type { DateKey } from '@/domain/time/localDate';
import { addDays } from '@/domain/time/localDate';

import { fatVsLean } from './fatVsLean';
import type { FatVsLean } from './fatVsLean';
import { weeklyLossRate } from './lossRate';
import type { LossRate } from './lossRate';
import { rangeForProfile } from './profileRange';
import { NEUTRAL_DESCRIPTOR, classify } from './ranges';
import type { BandStatus } from './ranges';
import { missingProfileFields } from './readings';
import type { ReadingMetrics } from './readings';
import { change30, dayPoints } from './series';
import { isLegacyOrigin } from './types';
import type { MetricId, Origin, Tier } from './types';

export interface MetricRowModel {
  id: MetricId;
  value: number;
  tier: Tier;
  origin: Origin;
  statusLabel: string | null;
  statusTone: BandStatus | null;
  descriptor: string | null;
}

export interface WeighInModel {
  readingId: number;
  measuredAt: string;
  date: DateKey;
  weightKg: number;
  bodyFatPct: number | null;
  bodyFatHollow: boolean;
}

export interface BodyOverview {
  latest: ReadingMetrics | null;
  weightChange30: number | null;
  /** The last 30 days of weight day points, ascending. */
  weightSpark: number[];
  rows: MetricRowModel[];
  lossRate: LossRate | null;
  fatVsLean: FatVsLean | null;
  /** Newest first, 4 rows. */
  recent: WeighInModel[];
  missing: ('height' | 'birthDate' | 'sex')[];
  /** The latest reading has no usable impedance, so only MovingLife's numbers (or none) show. */
  onlyLegacy: boolean;
}

/** Body page order; weight is the hero card, not a row. */
export const ROW_ORDER: readonly MetricId[] = [
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
];

const SPARK_DAYS = 30;
const RECENT_COUNT = 4;

function rowFor(
  id: MetricId,
  latest: ReadingMetrics,
  profile: Profile | null,
): MetricRowModel | null {
  const metric = latest.metrics[id];
  if (!metric) return null;
  const range = rangeForProfile(id, profile, latest.date);
  if (range === null) {
    return {
      id,
      value: metric.value,
      tier: metric.tier,
      origin: metric.origin,
      statusLabel: null,
      statusTone: null,
      descriptor: NEUTRAL_DESCRIPTOR[id] ?? null,
    };
  }
  const { band, statusLabel } = classify(range, metric.value);
  return {
    id,
    value: metric.value,
    tier: metric.tier,
    origin: metric.origin,
    statusLabel,
    statusTone: band.status,
    descriptor: null,
  };
}

function weighInOf(reading: ReadingMetrics): WeighInModel | null {
  const weight = reading.metrics.weight;
  if (!weight) return null;
  const bodyFat = reading.metrics.body_fat_pct;
  return {
    readingId: reading.id,
    measuredAt: reading.measuredAt,
    date: reading.date,
    weightKg: weight.value,
    bodyFatPct: bodyFat?.value ?? null,
    bodyFatHollow: bodyFat !== undefined && isLegacyOrigin(bodyFat.origin),
  };
}

/** Every reading with a weight, newest first. `readings` is ascending. */
export function allWeighIns(readings: readonly ReadingMetrics[]): WeighInModel[] {
  return readings.flatMap((reading) => weighInOf(reading) ?? []).reverse();
}

/**
 * Everything the Body page shows, from the computed readings and the profile in effect at the
 * latest reading. `readings` is ascending.
 */
export function buildBodyOverview(
  readings: readonly ReadingMetrics[],
  profile: Profile | null,
  today: DateKey,
): BodyOverview {
  const latest = readings[readings.length - 1] ?? null;
  const weightDays = dayPoints(readings, 'weight');
  const sparkFrom = addDays(today, -(SPARK_DAYS - 1));
  const rows =
    latest === null
      ? []
      : ROW_ORDER.flatMap((id) => {
          const row = rowFor(id, latest, profile);
          return row ? [row] : [];
        });

  return {
    latest,
    weightChange30: change30(weightDays, today),
    weightSpark: weightDays
      .filter((point) => point.date >= sparkFrom && point.date <= today)
      .map((point) => point.value),
    rows,
    lossRate: weeklyLossRate(weightDays, today),
    fatVsLean: fatVsLean(
      dayPoints(readings, 'fat_mass_kg'),
      dayPoints(readings, 'lean_mass_kg'),
      today,
    ),
    recent: allWeighIns(readings).slice(0, RECENT_COUNT),
    missing: missingProfileFields(profile),
    onlyLegacy: latest !== null && latest.metrics.body_fat_pct?.origin !== 'formula',
  };
}
