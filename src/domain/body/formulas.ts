import type { BmiCutoffs, Sex } from '@/domain/profile/profile';

/**
 * Bump when any coefficient, range or rounding rule in the engine changes. Nothing is stored, so
 * nothing needs migrating; Settings shows it and the export (Plan 6) records it.
 */
export const FORMULA_VERSION = 1;

/** Ruling 4: a resistance outside this range is a bad contact, not a body. */
export const IMPEDANCE_RANGE_OHM: readonly [number, number] = [200, 1200];
/** Ruling 4: a body fat outside this range is physically implausible for a living adult. */
export const BODY_FAT_PLAUSIBLE_PCT: readonly [number, number] = [3, 60];

/** Water density at 36.5 °C, kg per litre (the constant openScale uses to turn litres into kg). */
const WATER_KG_PER_LITRE = 0.99513;

interface ImpedanceInput {
  sex: Sex;
  heightCm: number;
  weightKg: number;
  impedanceOhm: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Height squared over resistance, the "impedance index" every BIA equation is built on. */
function impedanceIndex(heightCm: number, impedanceOhm: number): number {
  return (heightCm * heightCm) / impedanceOhm;
}

/** Body mass index, kg per square metre. */
export function bmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

/**
 * Fat-free mass in kg.
 * Sun SS, Chumlea WC, Heymsfield SB, et al. Am J Clin Nutr 2003;77(2):331-340.
 * doi:10.1093/ajcn/77.2.331. Resistance only (no reactance); developed in 1,829 adults.
 */
export function fatFreeMassSun(i: ImpedanceInput): number {
  const index = impedanceIndex(i.heightCm, i.impedanceOhm);
  return i.sex === 'male'
    ? -10.68 + 0.65 * index + 0.26 * i.weightKg + 0.02 * i.impedanceOhm
    : -9.53 + 0.69 * index + 0.17 * i.weightKg + 0.02 * i.impedanceOhm;
}

/**
 * Total body water in kg (the equation gives litres, converted at water's density at 36.5 °C).
 * Sun SS, Chumlea WC, Heymsfield SB, et al. Am J Clin Nutr 2003;77(2):331-340.
 * doi:10.1093/ajcn/77.2.331.
 */
export function totalBodyWaterKgSun(i: ImpedanceInput): number {
  const index = impedanceIndex(i.heightCm, i.impedanceOhm);
  const litres =
    i.sex === 'male'
      ? 1.2 + 0.45 * index + 0.18 * i.weightKg
      : 3.75 + 0.45 * index + 0.11 * i.weightKg;
  return litres * WATER_KG_PER_LITRE;
}

/**
 * Skeletal muscle mass in kg.
 * Janssen I, Heymsfield SB, Baumgartner RN, Ross R. J Appl Physiol 2000;89(2):465-471.
 * doi:10.1152/jappl.2000.89.2.465. MRI-referenced, 388 adults.
 */
export function skeletalMuscleKgJanssen(i: {
  sex: Sex;
  heightCm: number;
  age: number;
  impedanceOhm: number;
}): number {
  const male = i.sex === 'male' ? 1 : 0;
  return 0.401 * impedanceIndex(i.heightCm, i.impedanceOhm) + 3.825 * male - 0.071 * i.age + 5.102;
}

/**
 * Basal metabolic rate in kcal/day from lean mass: 370 + 21.6 × lean mass (kg).
 * Katch-McArdle, in McArdle WD, Katch FI, Katch VL. Exercise Physiology.
 */
export function bmrKatchMcArdle(leanMassKg: number): number {
  return 370 + 21.6 * leanMassKg;
}

/**
 * Basal metabolic rate in kcal/day without lean mass: 10·W + 6.25·H − 5·age, then +5 (male) or
 * −161 (female).
 * Mifflin MD, St Jeor ST, et al. Am J Clin Nutr 1990;51(2):241-247. doi:10.1093/ajcn/51.2.241.
 */
export function bmrMifflinStJeor(i: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
}): number {
  const base = 10 * i.weightKg + 6.25 * i.heightCm - 5 * i.age;
  return base + (i.sex === 'male' ? 5 : -161);
}

/**
 * Bone mass in kg as a fixed share of fat-free mass: 0.057 (male) or 0.05 (female).
 * Heuristic from openScale's StandardImpedanceLib (https://github.com/oliexdev/openScale).
 * Rough: no published foot-to-foot equation exists.
 */
export function boneMassKg(i: { sex: Sex; fatFreeMassKg: number }): number {
  return i.fatFreeMassKg * (i.sex === 'male' ? 0.057 : 0.05);
}

/**
 * Protein as a percentage of body weight: what is left of fat-free mass after water and bone.
 * Health Hub heuristic (Ruling 8), not a published equation. Rough.
 */
export function proteinPct(i: {
  fatFreeMassKg: number;
  waterKg: number;
  boneKg: number;
  weightKg: number;
}): number {
  return (Math.max(0, i.fatFreeMassKg - i.waterKg - i.boneKg) / i.weightKg) * 100;
}

/**
 * Body fat band edges by sex and age band (Gallagher, Ruling 10). Below `healthyFrom` is Low,
 * `healthyFrom` up to `slightlyHighFrom` is Healthy, then Slightly high, then High from `highFrom`.
 * Gallagher D, et al. Am J Clin Nutr 2000;72(3):694-701. doi:10.1093/ajcn/72.3.694.
 * The cells are the commonly reproduced values of the paper's Table 4.
 */
const BODY_FAT_BANDS = {
  male: [
    { healthyFrom: 8, slightlyHighFrom: 20, highFrom: 25 },
    { healthyFrom: 11, slightlyHighFrom: 22, highFrom: 28 },
    { healthyFrom: 13, slightlyHighFrom: 25, highFrom: 30 },
  ],
  female: [
    { healthyFrom: 21, slightlyHighFrom: 33, highFrom: 39 },
    { healthyFrom: 23, slightlyHighFrom: 34, highFrom: 40 },
    { healthyFrom: 24, slightlyHighFrom: 36, highFrom: 42 },
  ],
} as const;

/** Ages under 20 use the 20-39 row and ages over 79 the 60-79 row. */
export function bodyFatBand(
  sex: Sex,
  age: number,
): { healthyFrom: number; slightlyHighFrom: number; highFrom: number } {
  const row = age < 40 ? 0 : age < 60 ? 1 : 2;
  return { ...BODY_FAT_BANDS[sex][row] };
}

/**
 * The healthy BMI band: 18.5 up to 25 (WHO standard) or 23 (WHO Asian action points).
 * WHO Expert Consultation, Lancet 2004;363:157-163. doi:10.1016/S0140-6736(03)15268-3.
 */
export function bmiHealthyBand(cutoffs: BmiCutoffs): { low: number; high: number } {
  return { low: 18.5, high: cutoffs === 'who_asian' ? 23 : 25 };
}

/** Ruling 4: a usable impedance is in range and gives a plausible body fat. */
export function impedanceIsUsable(i: ImpedanceInput): boolean {
  const [minOhm, maxOhm] = IMPEDANCE_RANGE_OHM;
  if (!Number.isFinite(i.impedanceOhm) || i.impedanceOhm < minOhm || i.impedanceOhm > maxOhm) {
    return false;
  }
  if (!(i.weightKg > 0) || !(i.heightCm > 0)) return false;
  const bodyFat = ((i.weightKg - fatFreeMassSun(i)) / i.weightKg) * 100;
  const [minFat, maxFat] = BODY_FAT_PLAUSIBLE_PCT;
  return bodyFat >= minFat && bodyFat <= maxFat;
}

/**
 * Visceral fat rating, 1 to 30. Health Hub heuristic (Ruling 8): rises with body fat above a
 * sex-specific reference and with age past 30. Rough: no published foot-to-foot equation exists.
 */
export function visceralRating(i: { sex: Sex; age: number; bodyFatPct: number }): number {
  const reference = i.sex === 'male' ? 15.5 : 25.5;
  const raw = 0.8 * (i.bodyFatPct - reference) + 0.1 * Math.max(0, i.age - 30);
  return clamp(Math.round(raw), 1, 30);
}

/**
 * Metabolic age, 18 to 80: age shifted by half the distance from the middle of the Gallagher
 * healthy body-fat band. Health Hub heuristic (Ruling 8). Rough.
 */
export function metabolicAge(i: { sex: Sex; age: number; bodyFatPct: number }): number {
  const band = bodyFatBand(i.sex, i.age);
  const mid = (band.healthyFrom + band.slightlyHighFrom) / 2;
  return clamp(Math.round(i.age + 0.5 * (i.bodyFatPct - mid)), 18, 80);
}

/**
 * Health score, 0 to 100: 100 minus penalties for body fat, BMI and visceral rating outside their
 * healthy ranges. Health Hub heuristic (Ruling 8). Rough.
 */
export function healthScore(i: {
  sex: Sex;
  age: number;
  bodyFatPct: number;
  bmi: number;
  visceral: number;
  bmiCutoffs: BmiCutoffs;
}): number {
  const fatBand = bodyFatBand(i.sex, i.age);
  const bfExcess = Math.max(
    0,
    fatBand.healthyFrom - i.bodyFatPct,
    i.bodyFatPct - fatBand.slightlyHighFrom,
  );
  const bmiBand = bmiHealthyBand(i.bmiCutoffs);
  const bmiExcess = Math.max(0, bmiBand.low - i.bmi, i.bmi - bmiBand.high);
  const visceralExcess = Math.max(0, i.visceral - 9);
  return clamp(Math.round(100 - 4 * bfExcess - 5 * bmiExcess - 3 * visceralExcess), 0, 100);
}
