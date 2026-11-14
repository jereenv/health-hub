import { FORMULA_SOURCES } from './sources';
import type { FormulaSource } from './sources';
import type { MetricId, Origin } from './types';

export interface Explainer {
  what: string;
  moves: string;
  reliability: string;
  /** Ids from FORMULA_SOURCES for the formula and range this metric uses. */
  formulaSourceIds: readonly string[];
}

const ROUGH = 'A rough estimate. No published equation exists for a foot scale.';

/** Shown instead of the formula citation when a value is MovingLife's own number. */
export const MOVINGLIFE_NOTE =
  "This value is MovingLife's own number, imported from your history. It is not comparable to Health Hub's formula, so the chart marks it with hollow points and never joins the two.";

export const EXPLAINERS: Readonly<Record<MetricId, Explainer>> = {
  weight: {
    what: 'Your total body weight, measured by the scale.',
    moves:
      'Water, food, salt and the time of day move it by a kilogram or more within a day. Real fat or muscle change is much slower.',
    reliability:
      'The scale is accurate, but a single reading is noisy. Trust the 7-day trend over any single reading.',
    formulaSourceIds: [],
  },
  bmi: {
    what: 'Your weight divided by your height squared. It is exact arithmetic, not an estimate.',
    moves: 'It moves with your weight only. Your height comes from your profile.',
    reliability:
      'BMI ignores muscle, so a muscular person can read high without carrying extra fat. Use it as a rough screen, together with body fat.',
    formulaSourceIds: ['who2004'],
  },
  body_fat_pct: {
    what: 'The share of your weight that is fat. The scale sends a tiny current through your legs; the app turns how easily it passes into an estimate using your height, age and sex.',
    moves:
      'Hydration, a recent meal and exercise change how the current flows, so readings wander by a point or two. Compare weeks, not days.',
    reliability:
      'Expect it to land within about 3 to 5 points of a lab scan. The equation was built on whole-body measurements and a foot-to-foot scale differs from the whole-body method, so values will not match other apps exactly.',
    formulaSourceIds: ['sun2003', 'gallagher2000'],
  },
  fat_mass_kg: {
    what: 'The weight of the fat in your body: your weight multiplied by your body fat share.',
    moves: 'It follows body fat and weight. It falls when you lose fat and rises when you gain it.',
    reliability:
      'It is only as reliable as the body fat estimate it comes from. For imported MovingLife readings it is derived from MovingLife body fat.',
    formulaSourceIds: ['sun2003'],
  },
  lean_mass_kg: {
    what: 'Everything in your body that is not fat: muscle, bone, water and organs.',
    moves: 'Water shifts move it day to day. Over months it follows muscle gained or lost.',
    reliability:
      'It is your weight minus the fat estimate, so it carries the same uncertainty. For imported MovingLife readings it is derived from MovingLife body fat.',
    formulaSourceIds: ['sun2003'],
  },
  water_pct: {
    what: 'The share of your weight that is water, estimated from how easily the current passes through you.',
    moves:
      'Drinking, salt, caffeine, a hard workout and the time of day all move it. Compare readings taken in similar conditions.',
    reliability:
      'Foot-to-foot scales differ from the whole-body method this equation was built on. Treat the level loosely and the direction more seriously.',
    formulaSourceIds: ['sun2003', 'vendor'],
  },
  muscle_pct: {
    what: 'The share of your weight that is skeletal muscle, the muscle you train, estimated from your height, age, sex and the current through your legs.',
    moves:
      'It rises slowly with training and protein, and falls with long breaks or aggressive dieting. Hydration shifts it a little day to day.',
    reliability:
      'The equation was developed against MRI scans in adults and tends to underestimate in some groups. Foot-to-foot scales differ from the whole-body method it was built on.',
    formulaSourceIds: ['janssen2000', 'janssen2002'],
  },
  bmr_kcal: {
    what: 'The energy your body would burn in a day at complete rest. With a lean mass estimate it uses Katch-McArdle; without one it uses Mifflin-St Jeor from your weight, height, age and sex.',
    moves:
      'It rises with lean mass and falls as you lose weight or age. It does not change with a single day of eating or training.',
    reliability:
      'Both formulas are averages across many people, so your own figure can differ by a few hundred kcal. It is not your calorie target; activity comes on top.',
    formulaSourceIds: ['katchMcArdle', 'mifflin1990'],
  },
  visceral_rating: {
    what: 'A rating from 1 to 30 for fat stored around the organs. Lower is better.',
    moves: 'It tends to follow your overall body fat and rises a little with age.',
    reliability: `${ROUGH} Treat it as a number to watch over time, not a medical result.`,
    formulaSourceIds: ['vendor'],
  },
  bone_mass_kg: {
    what: 'An estimate of the weight of the mineral in your bones, taken as a fixed share of your lean mass.',
    moves:
      'It moves only with your lean mass estimate. Real bone mass changes over years, not weeks.',
    reliability: `${ROUGH} The share used is the one from the openScale project, so it restates lean mass rather than measuring bone.`,
    formulaSourceIds: ['openscale', 'vendor'],
  },
  protein_pct: {
    what: 'The share of your weight left after taking away fat, water and bone, which is mostly protein.',
    moves: 'It follows the water and lean mass estimates, so it shifts with hydration.',
    reliability: ROUGH,
    formulaSourceIds: ['openscale', 'vendor'],
  },
  metabolic_age: {
    what: 'The age at which a typical person would have your body fat. It is higher than your age when your body fat is above the healthy range.',
    moves: 'It moves with your body fat and nothing else.',
    reliability: `${ROUGH} It is for reference only.`,
    formulaSourceIds: ['gallagher2000', 'vendor'],
  },
  health_score: {
    what: 'A score from 0 to 100 that falls as body fat, BMI and visceral fat move outside their healthy ranges.',
    moves: 'It improves as those three numbers move back toward their healthy ranges.',
    reliability: `${ROUGH} It is for reference only.`,
    formulaSourceIds: ['gallagher2000', 'who2004', 'vendor'],
  },
};

function sourcesById(ids: readonly string[]): FormulaSource[] {
  return ids.flatMap((id) => FORMULA_SOURCES.filter((source) => source.id === id));
}

/**
 * The citations to show for a metric. MovingLife's own number has no formula of ours behind it;
 * a value derived from MovingLife body fat drops the Sun equation, which it does not use.
 */
export function explainerSources(metric: MetricId, origin: Origin): readonly FormulaSource[] {
  if (origin === 'movinglife') return [];
  const ids = EXPLAINERS[metric].formulaSourceIds;
  const used = origin === 'movinglife_derived' ? ids.filter((id) => id !== 'sun2003') : ids;
  return sourcesById(used);
}
