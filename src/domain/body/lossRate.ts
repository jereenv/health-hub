import type { DateKey } from '@/domain/time/localDate';
import { addDays, daysBetween } from '@/domain/time/localDate';

import type { DayPoint } from './series';

export interface LossRate {
  kgPerWeek: number;
  percentPerWeek: number;
  status: 'gaining' | 'steady' | 'slow' | 'healthy' | 'fast';
}

const WINDOW_DAYS = 28;
const MIN_POINTS = 3;
const MIN_SPAN_DAYS = 14;
const STEADY_BELOW_PCT = 0.05;
const HEALTHY_FROM_PCT = 0.5;
const HEALTHY_TO_PCT = 1;

/**
 * Ruling 15: the least-squares slope of the weight day points of the last 28 days, today
 * included. Positive means losing. 0.5 to 1 % of body weight per week is the healthy band
 * (Helms ER, et al. J Int Soc Sports Nutr 2014;11:20). Null with fewer than 3 points or a
 * span under 14 days.
 */
export function weeklyLossRate(weightDays: readonly DayPoint[], today: DateKey): LossRate | null {
  const from = addDays(today, -(WINDOW_DAYS - 1));
  const points = weightDays.filter((point) => point.date >= from && point.date <= today);
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || points.length < MIN_POINTS) return null;
  if (daysBetween(first.date, last.date) < MIN_SPAN_DAYS) return null;

  const xs = points.map((point) => daysBetween(first.date, point.date));
  const ys = points.map((point) => point.value);
  const meanX = xs.reduce((sum, x) => sum + x, 0) / xs.length;
  const meanY = ys.reduce((sum, y) => sum + y, 0) / ys.length;
  let covariance = 0;
  let variance = 0;
  xs.forEach((x, index) => {
    covariance += (x - meanX) * ((ys[index] as number) - meanY);
    variance += (x - meanX) ** 2;
  });
  if (variance === 0) return null;

  const kgPerWeek = (-covariance / variance) * 7;
  const percentPerWeek = (kgPerWeek / meanY) * 100;
  return { kgPerWeek, percentPerWeek, status: statusFor(percentPerWeek) };
}

function statusFor(percentPerWeek: number): LossRate['status'] {
  if (Math.abs(percentPerWeek) < STEADY_BELOW_PCT) return 'steady';
  if (percentPerWeek < 0) return 'gaining';
  if (percentPerWeek < HEALTHY_FROM_PCT) return 'slow';
  return percentPerWeek <= HEALTHY_TO_PCT ? 'healthy' : 'fast';
}
