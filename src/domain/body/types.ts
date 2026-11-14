import type { BmiCutoffs, Sex } from '@/domain/profile/profile';

export type MetricId =
  | 'weight'
  | 'bmi'
  | 'body_fat_pct'
  | 'fat_mass_kg'
  | 'lean_mass_kg'
  | 'water_pct'
  | 'muscle_pct'
  | 'bmr_kcal'
  | 'visceral_rating'
  | 'bone_mass_kg'
  | 'protein_pct'
  | 'metabolic_age'
  | 'health_score';

export const METRIC_IDS: readonly MetricId[] = [
  'weight',
  'bmi',
  'body_fat_pct',
  'fat_mass_kg',
  'lean_mass_kg',
  'water_pct',
  'muscle_pct',
  'bmr_kcal',
  'visceral_rating',
  'bone_mass_kg',
  'protein_pct',
  'metabolic_age',
  'health_score',
];

export type Tier = 'measured' | 'exact' | 'estimated' | 'rough';

/**
 * scale: measured by the scale. formula: our engine. movinglife: MovingLife's own number.
 * movinglife_derived: our maths on MovingLife's body fat.
 */
export type Origin = 'scale' | 'formula' | 'movinglife' | 'movinglife_derived';

export interface MetricValue {
  value: number;
  tier: Tier;
  origin: Origin;
}

export type BodyMetrics = Partial<Record<MetricId, MetricValue>>;

export interface BodyInput {
  weightKg: number;
  impedanceOhm: number | null;
  legacyBodyFatPct: number | null;
  heightCm: number | null;
  ageYears: number | null;
  sex: Sex | null;
  bmiCutoffs: BmiCutoffs;
}

export interface MetricMeta {
  label: string;
  unit: '' | '%' | 'kg' | 'kcal' | 'yrs';
  kind: 'mass' | 'percent' | 'index' | 'energy' | 'rating' | 'age';
  decimals: number;
}

export const METRIC_META: Readonly<Record<MetricId, MetricMeta>> = {
  weight: { label: 'Weight', unit: 'kg', kind: 'mass', decimals: 1 },
  bmi: { label: 'BMI', unit: '', kind: 'index', decimals: 1 },
  body_fat_pct: { label: 'Body fat', unit: '%', kind: 'percent', decimals: 1 },
  fat_mass_kg: { label: 'Fat mass', unit: 'kg', kind: 'mass', decimals: 1 },
  lean_mass_kg: { label: 'Lean mass', unit: 'kg', kind: 'mass', decimals: 1 },
  water_pct: { label: 'Body water', unit: '%', kind: 'percent', decimals: 1 },
  muscle_pct: { label: 'Muscle', unit: '%', kind: 'percent', decimals: 1 },
  bmr_kcal: { label: 'BMR', unit: 'kcal', kind: 'energy', decimals: 0 },
  visceral_rating: { label: 'Visceral fat', unit: '', kind: 'rating', decimals: 0 },
  bone_mass_kg: { label: 'Bone mass', unit: 'kg', kind: 'mass', decimals: 1 },
  protein_pct: { label: 'Protein', unit: '%', kind: 'percent', decimals: 1 },
  metabolic_age: { label: 'Metabolic age', unit: 'yrs', kind: 'age', decimals: 0 },
  health_score: { label: 'Health score', unit: '', kind: 'rating', decimals: 0 },
};

export function isLegacyOrigin(origin: Origin): boolean {
  return origin === 'movinglife' || origin === 'movinglife_derived';
}
