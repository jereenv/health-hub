import type { BandStatus } from './ranges';
import type { MetricId } from './types';

export interface TipInput {
  metric: MetricId;
  band: BandStatus | null;
  bandLabel: string | null;
  /** Change over the last 30 days within the same method; negative means down. */
  change30: number | null;
  goalWeightKg: number | null;
  latestWeightKg: number | null;
}

/**
 * A rule-based tip, never generated. The text carries the literal placeholder `{x}` where the
 * caller puts the absolute 30-day change. Returns null when no rule matches; the first match wins.
 */
export function tipFor(input: TipInput): string | null {
  const { metric, band, change30, goalWeightKg, latestWeightKg } = input;

  switch (metric) {
    case 'body_fat_pct':
      if (band === 'high' && change30 !== null && change30 <= -0.3) {
        return 'Down {x} points in 30 days, a steady pace. Keep protein high so the loss stays mostly fat.';
      }
      if (band === 'high') {
        return 'Body fat is above your range. A modest calorie deficit with regular lifting is the reliable route.';
      }
      if (band === 'low') {
        return 'Body fat is below your range. Make sure you are eating enough to train and recover.';
      }
      return null;
    case 'muscle_pct':
      if (band === 'low') {
        return 'Muscle share is below the usual range. Lifting and enough protein are the levers.';
      }
      if (change30 !== null && change30 <= -1) {
        return 'Muscle share is falling. Keep lifting and protein up while you lose weight.';
      }
      return null;
    case 'water_pct':
      if (band === 'low') {
        return 'A low reading is often hydration. Drink water, then weigh again in similar conditions.';
      }
      if (band === 'high') {
        return 'A high reading is usually salt or a recent big drink. Compare with your 7-day trend.';
      }
      return null;
    case 'visceral_rating':
      return band === 'high' ? 'Visceral fat falls mainly as your overall body fat falls.' : null;
    case 'protein_pct':
      return band === 'low'
        ? 'Protein share is below the usual range. Check your daily protein intake.'
        : null;
    case 'bmi':
      return band === 'high'
        ? 'BMI does not separate muscle from fat. Check body fat before drawing conclusions.'
        : null;
    case 'weight':
      if (
        goalWeightKg !== null &&
        latestWeightKg !== null &&
        latestWeightKg > goalWeightKg &&
        change30 !== null &&
        change30 >= 0.5
      ) {
        return 'Weight is up {x} in 30 days while your goal is lower. Check the week-to-week trend.';
      }
      return null;
    default:
      return null;
  }
}
