import {
  bmi as bmiOf,
  bmrKatchMcArdle,
  bmrMifflinStJeor,
  boneMassKg,
  fatFreeMassSun,
  healthScore,
  impedanceIsUsable,
  metabolicAge,
  proteinPct,
  skeletalMuscleKgJanssen,
  totalBodyWaterKgSun,
  visceralRating,
} from './formulas';
import type { BodyInput, BodyMetrics, MetricId, Origin, Tier } from './types';

function isPositive(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}

/**
 * Every metric the inputs support; a metric whose inputs are missing is absent. Never throws and
 * never returns NaN: unusable weight returns {}.
 */
export function computeBodyMetrics(input: BodyInput): BodyMetrics {
  const { weightKg, impedanceOhm, legacyBodyFatPct, heightCm, ageYears, sex, bmiCutoffs } = input;
  if (!isPositive(weightKg)) return {};

  const metrics: BodyMetrics = {};
  const put = (id: MetricId, value: number, tier: Tier, origin: Origin): void => {
    if (Number.isFinite(value)) metrics[id] = { value, tier, origin };
  };

  put('weight', weightKg, 'measured', 'scale');
  const height = isPositive(heightCm) ? heightCm : null;
  const age = ageYears !== null && Number.isFinite(ageYears) && ageYears >= 0 ? ageYears : null;
  const bmiValue = height === null ? null : bmiOf(weightKg, height);
  if (bmiValue !== null) put('bmi', bmiValue, 'exact', 'formula');
  // Without a sex only the impedance equations and Mifflin BMR are unavailable; MovingLife's own
  // body fat needs neither sex, height nor age.
  const impedance =
    sex !== null &&
    height !== null &&
    isPositive(impedanceOhm) &&
    impedanceIsUsable({ sex, heightCm: height, weightKg, impedanceOhm })
      ? { sex, heightCm: height, impedanceOhm }
      : null;

  let leanMass: { value: number; origin: Origin } | null = null;

  if (impedance) {
    const { sex, ...body } = impedance; // `sex` is non-null here
    const ffm = fatFreeMassSun({ sex, weightKg, ...body });
    const bodyFatPct = ((weightKg - ffm) / weightKg) * 100;
    put('body_fat_pct', bodyFatPct, 'estimated', 'formula');
    put('fat_mass_kg', weightKg - ffm, 'estimated', 'formula');
    put('lean_mass_kg', ffm, 'estimated', 'formula');
    leanMass = { value: ffm, origin: 'formula' };

    const waterKg = totalBodyWaterKgSun({ sex, weightKg, ...body });
    put('water_pct', (waterKg / weightKg) * 100, 'estimated', 'formula');
    if (age !== null) {
      const muscleKg = skeletalMuscleKgJanssen({ sex, age, ...body });
      put('muscle_pct', (muscleKg / weightKg) * 100, 'estimated', 'formula');
    }

    const boneKg = boneMassKg({ sex, fatFreeMassKg: ffm });
    put('bone_mass_kg', boneKg, 'rough', 'formula');
    put(
      'protein_pct',
      proteinPct({ fatFreeMassKg: ffm, waterKg, boneKg, weightKg }),
      'rough',
      'formula',
    );
    if (age !== null) {
      const visceral = visceralRating({ sex, age, bodyFatPct });
      put('visceral_rating', visceral, 'rough', 'formula');
      put('metabolic_age', metabolicAge({ sex, age, bodyFatPct }), 'rough', 'formula');
      if (bmiValue !== null) {
        put(
          'health_score',
          healthScore({ sex, age, bodyFatPct, bmi: bmiValue, visceral, bmiCutoffs }),
          'rough',
          'formula',
        );
      }
    }
  } else if (
    legacyBodyFatPct !== null &&
    Number.isFinite(legacyBodyFatPct) &&
    legacyBodyFatPct > 0 &&
    legacyBodyFatPct < 100
  ) {
    const fat = (weightKg * legacyBodyFatPct) / 100;
    put('body_fat_pct', legacyBodyFatPct, 'estimated', 'movinglife');
    put('fat_mass_kg', fat, 'estimated', 'movinglife_derived');
    put('lean_mass_kg', weightKg - fat, 'estimated', 'movinglife_derived');
    leanMass = { value: weightKg - fat, origin: 'movinglife_derived' };
  }

  if (leanMass) {
    put('bmr_kcal', bmrKatchMcArdle(leanMass.value), 'estimated', leanMass.origin);
  } else if (sex !== null && height !== null && age !== null) {
    put(
      'bmr_kcal',
      bmrMifflinStJeor({ sex, weightKg, heightCm: height, age }),
      'estimated',
      'formula',
    );
  }

  return metrics;
}
