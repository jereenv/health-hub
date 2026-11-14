import type { ActivityDay, HeartRateDay } from '@/data/healthconnect/HealthConnectRepository';
import { buildSleepNights } from '@/domain/activity/sleepNights';
import type { SleepNight } from '@/domain/activity/sleepNights';
import { formatDistance } from '@/domain/format/units';
import type { DateKey } from '@/domain/time/localDate';
import type { WeightUnit } from '@/domain/workouts/types';

import { datesIn, inWindow } from './period';
import type { Prepared } from './prepare';
import type { DateWindow } from './types';

/** The window without today: only these days are complete, so only they feed averages. */
export function completedDays(window: DateWindow, today: DateKey): DateKey[] {
  return datesIn(window).filter((date) => date < today);
}

export function activityByDate(prep: Prepared): Map<DateKey, ActivityDay> {
  return new Map(prep.data.activity.map((day) => [day.date, day]));
}

export function heartRateByDate(prep: Prepared): Map<DateKey, HeartRateDay> {
  return new Map(prep.data.heartRate.map((day) => [day.date, day]));
}

/** One night per wake date; a night that just ended today is complete and counts. */
export function nightsIn(prep: Prepared, window: DateWindow | null): SleepNight[] {
  if (!window) return [];
  return buildSleepNights(prep.data.sleep).filter((night) => inWindow(night.date, window));
}

export function distanceUnit(unit: WeightUnit): 'mi' | 'km' {
  return unit === 'lb' ? 'mi' : 'km';
}

/** '7.0' for 7000 m in km, miles for lb; the unit goes in the column header. */
export function distanceNumber(meters: number, unit: WeightUnit): string {
  return formatDistance(meters, unit).split(' ')[0] as string;
}

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
