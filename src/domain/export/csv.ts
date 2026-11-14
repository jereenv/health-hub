import { dayPoints } from '@/domain/body/series';
import type { DayPoint } from '@/domain/body/series';
import type { MetricId } from '@/domain/body/types';
import { kgToUnit } from '@/domain/format/units';
import type { DateKey } from '@/domain/time/localDate';
import { localDateKey } from '@/domain/time/localDate';
import { workoutVolumeKg } from '@/domain/workouts/metrics';
import type { WeightUnit } from '@/domain/workouts/types';

import { activityByDate, heartRateByDate, nightsIn } from './dailyData';
import { mean } from './markdown';
import { datesIn } from './period';
import type { Prepared } from './prepare';
import type { PeriodView } from './types';

const METERS_PER_KM = 1000;
const METERS_PER_MILE = 1609.344;
const SECONDS_PER_HOUR = 3600;

function headerFor(unit: WeightUnit): string {
  const mass = unit === 'lb' ? 'lb' : 'kg';
  return [
    'date',
    `weight_${mass}`,
    'body_fat_pct',
    'body_fat_source',
    `fat_mass_${mass}`,
    `lean_mass_${mass}`,
    'bmi',
    'bmr_kcal',
    'watch_body_fat_pct',
    'workouts',
    `volume_${mass}`,
    'steps',
    unit === 'lb' ? 'distance_mi' : 'distance_km',
    'asleep_hours',
    'hr_min',
    'hr_avg',
    'hr_max',
  ].join(',');
}

/** Up to 2 decimals, no thousands separator, no trailing zeros. */
function num(value: number): string {
  return String(Number(value.toFixed(2)));
}

function byDate(points: readonly DayPoint[]): Map<DateKey, DayPoint> {
  return new Map(points.map((point) => [point.date, point]));
}

/**
 * One row per day from the first day with data to today. A missing value is an empty cell, never
 * 0 (the workout count is a real count). Today's steps, distance and heart rate are partial and
 * left empty. Nothing here contains a comma, quote or newline, so nothing is quoted.
 */
export function buildJourneyCsv(
  prep: Prepared,
  view: PeriodView,
): { fileName: string; content: string } {
  const unit = view.unit;
  const metric = (id: MetricId): Map<DateKey, DayPoint> => byDate(dayPoints(prep.readings, id));
  const weight = metric('weight');
  const fat = metric('body_fat_pct');
  const fatMass = metric('fat_mass_kg');
  const lean = metric('lean_mass_kg');
  const bmi = metric('bmi');
  const bmr = metric('bmr_kcal');

  const watch = new Map<DateKey, number[]>();
  for (const check of prep.data.watch) {
    const date = localDateKey(check.measuredAt);
    const group = watch.get(date);
    if (group) group.push(check.bodyFatPct);
    else watch.set(date, [check.bodyFatPct]);
  }
  const sessions = new Map<DateKey, { count: number; volumeKg: number }>();
  for (const workout of prep.data.workouts) {
    const date = localDateKey(workout.performedAt);
    const known = sessions.get(date) ?? { count: 0, volumeKg: 0 };
    sessions.set(date, {
      count: known.count + 1,
      volumeKg: known.volumeKg + workoutVolumeKg(workout),
    });
  }
  const activity = activityByDate(prep);
  const heartRate = heartRateByDate(prep);
  const nights = new Map(nightsIn(prep, view.window).map((night) => [night.date, night]));

  const mass = (point: DayPoint | undefined): string =>
    point === undefined ? '' : num(kgToUnit(point.value, unit));
  const plain = (point: DayPoint | undefined): string =>
    point === undefined ? '' : num(point.value);

  const rows = datesIn(view.window).map((date) => {
    const partial = date === view.today;
    const fatPoint = fat.get(date);
    const source =
      fatPoint === undefined ? '' : fatPoint.origin === 'formula' ? 'formula' : 'movinglife';
    const checks = watch.get(date);
    const checkMean = checks === undefined ? null : mean(checks);
    const session = sessions.get(date);
    const day = activity.get(date);
    const beats = heartRate.get(date);
    const night = nights.get(date);
    const distanceM = partial ? null : (day?.distanceM ?? null);
    const divisor = unit === 'lb' ? METERS_PER_MILE : METERS_PER_KM;
    return [
      date,
      mass(weight.get(date)),
      plain(fatPoint),
      source,
      mass(fatMass.get(date)),
      mass(lean.get(date)),
      plain(bmi.get(date)),
      plain(bmr.get(date)),
      checkMean === null ? '' : num(checkMean),
      String(session?.count ?? 0),
      session === undefined ? '' : num(kgToUnit(session.volumeKg, unit)),
      partial || day?.steps == null ? '' : num(day.steps),
      distanceM === null ? '' : num(distanceM / divisor),
      night === undefined ? '' : num(night.asleepS / SECONDS_PER_HOUR),
      partial || beats === undefined ? '' : num(beats.minBpm),
      partial || beats === undefined ? '' : num(beats.avgBpm),
      partial || beats === undefined ? '' : num(beats.maxBpm),
    ].join(',');
  });

  return {
    fileName: 'health-hub-journey.csv',
    content: `${[headerFor(unit), ...rows].join('\n')}\n`,
  };
}
