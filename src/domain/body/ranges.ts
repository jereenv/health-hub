import type { BmiCutoffs, Sex } from '@/domain/profile/profile';

import { bmiHealthyBand, bodyFatBand } from './formulas';
import type { MetricId } from './types';

export type BandStatus = 'low' | 'ok' | 'high';

/** `[from, to)`; null is open-ended. */
export interface RangeBand {
  label: string;
  from: number | null;
  to: number | null;
  status: BandStatus;
}

export interface MetricRange {
  bands: readonly RangeBand[];
  /** The bar's domain; bands are drawn clamped to it. */
  scaleMin: number;
  scaleMax: number;
  source: string;
  sourceId: string;
}

export interface RangeContext {
  sex: Sex;
  ageYears: number | null;
  heightCm: number | null;
  bmiCutoffs: BmiCutoffs;
}

export interface Classified {
  band: RangeBand;
  statusLabel: string;
}

const SOURCE_GALLAGHER = 'Gallagher et al., 2000';
const SOURCE_JANSSEN = 'Janssen et al., 2002';
const SOURCE_VENDOR = 'conventional vendor range';

const BMI_SCALE: readonly [number, number] = [15, 40];

/** Builds contiguous bands from labelled cut points: the first band is open below, the last open above. */
function bandsFrom(
  labels: readonly string[],
  statuses: readonly BandStatus[],
  cuts: readonly number[],
): RangeBand[] {
  return labels.map((label, index) => ({
    label,
    from: index === 0 ? null : (cuts[index - 1] ?? null),
    to: index === labels.length - 1 ? null : (cuts[index] ?? null),
    status: statuses[index] ?? 'ok',
  }));
}

function bodyFatRange(ctx: RangeContext): MetricRange | null {
  if (ctx.ageYears === null) return null;
  const band = bodyFatBand(ctx.sex, ctx.ageYears);
  return {
    bands: bandsFrom(
      ['Low', 'Healthy', 'Slightly high', 'High'],
      ['low', 'ok', 'high', 'high'],
      [band.healthyFrom, band.slightlyHighFrom, band.highFrom],
    ),
    scaleMin: 4,
    scaleMax: 45,
    source: SOURCE_GALLAGHER,
    sourceId: 'gallagher2000',
  };
}

function bmiCuts(cutoffs: BmiCutoffs): number[] {
  const healthy = bmiHealthyBand(cutoffs);
  return [healthy.low, healthy.high, cutoffs === 'who_asian' ? 27.5 : 30];
}

function bmiRange(ctx: RangeContext): MetricRange {
  return {
    bands: bandsFrom(
      ['Low', 'Healthy', 'Slightly high', 'High'],
      ['low', 'ok', 'high', 'high'],
      bmiCuts(ctx.bmiCutoffs),
    ),
    scaleMin: BMI_SCALE[0],
    scaleMax: BMI_SCALE[1],
    source:
      ctx.bmiCutoffs === 'who_asian' ? 'WHO (Asian action points)' : 'WHO (standard cut-offs)',
    sourceId: 'who2004',
  };
}

/** The BMI bands converted to kilograms for the owner's height: kg = BMI × (H / 100)². */
function weightRange(ctx: RangeContext): MetricRange | null {
  if (ctx.heightCm === null) return null;
  const heightM = ctx.heightCm / 100;
  const toKg = (bmi: number) => bmi * heightM * heightM;
  const bmi = bmiRange(ctx);
  return {
    ...bmi,
    bands: bmi.bands.map((band) => ({
      ...band,
      from: band.from === null ? null : toKg(band.from),
      to: band.to === null ? null : toKg(band.to),
    })),
    scaleMin: toKg(BMI_SCALE[0]),
    scaleMax: toKg(BMI_SCALE[1]),
  };
}

function muscleRange(ctx: RangeContext): MetricRange {
  const male = ctx.sex === 'male';
  return {
    bands: bandsFrom(
      ['Very low', 'Low', 'Healthy'],
      ['low', 'low', 'ok'],
      male ? [31, 37] : [22, 28],
    ),
    scaleMin: male ? 20 : 15,
    scaleMax: male ? 55 : 45,
    source: SOURCE_JANSSEN,
    sourceId: 'janssen2002',
  };
}

function waterRange(ctx: RangeContext): MetricRange {
  return {
    bands: bandsFrom(
      ['Low', 'Healthy', 'High'],
      ['low', 'ok', 'high'],
      ctx.sex === 'male' ? [50, 65] : [45, 60],
    ),
    scaleMin: 35,
    scaleMax: 75,
    source: SOURCE_VENDOR,
    sourceId: 'vendor',
  };
}

function proteinRange(): MetricRange {
  return {
    bands: bandsFrom(['Low', 'Healthy', 'High'], ['low', 'ok', 'high'], [16, 20]),
    scaleMin: 8,
    scaleMax: 30,
    source: SOURCE_VENDOR,
    sourceId: 'vendor',
  };
}

function visceralRange(): MetricRange {
  return {
    bands: bandsFrom(['Healthy', 'High', 'Very high'], ['ok', 'high', 'high'], [10, 15]),
    scaleMin: 1,
    scaleMax: 20,
    source: SOURCE_VENDOR,
    sourceId: 'vendor',
  };
}

/** The range for a metric, or null when it has none (Ruling 10) or an input it needs is missing. */
export function rangeFor(metric: MetricId, ctx: RangeContext): MetricRange | null {
  switch (metric) {
    case 'body_fat_pct':
      return bodyFatRange(ctx);
    case 'bmi':
      return bmiRange(ctx);
    case 'weight':
      return weightRange(ctx);
    case 'muscle_pct':
      return muscleRange(ctx);
    case 'water_pct':
      return waterRange(ctx);
    case 'protein_pct':
      return proteinRange();
    case 'visceral_rating':
      return visceralRange();
    default:
      return null;
  }
}

/** The band holding `value`; a value on a boundary belongs to the upper band. */
export function classify(range: MetricRange, value: number): Classified {
  const bands = range.bands;
  const found =
    bands.find(
      (band) => (band.from === null || value >= band.from) && (band.to === null || value < band.to),
    ) ?? bands[bands.length - 1];
  if (!found) throw new RangeError('A range has at least one band');
  return { band: found, statusLabel: found.label };
}

export const NEUTRAL_DESCRIPTOR: Readonly<Partial<Record<MetricId, string>>> = {
  fat_mass_kg: 'Estimate',
  lean_mass_kg: 'Estimate',
  bmr_kcal: 'Daily baseline',
  bone_mass_kg: 'Estimate',
  metabolic_age: 'For reference',
  health_score: 'For reference',
};
