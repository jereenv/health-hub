import { EXPLAINERS, MOVINGLIFE_NOTE, explainerSources } from './explainers';
import { FORMULA_SOURCES } from './sources';
import { METRIC_IDS } from './types';

test('every metric has non-empty what, moves and reliability', () => {
  for (const metric of METRIC_IDS) {
    const explainer = EXPLAINERS[metric];
    expect(explainer.what.trim().length).toBeGreaterThan(0);
    expect(explainer.moves.trim().length).toBeGreaterThan(0);
    expect(explainer.reliability.trim().length).toBeGreaterThan(0);
  }
});

test('every formulaSourceId exists in FORMULA_SOURCES', () => {
  const known = new Set(FORMULA_SOURCES.map((source) => source.id));
  for (const metric of METRIC_IDS) {
    for (const id of EXPLAINERS[metric].formulaSourceIds) expect(known.has(id)).toBe(true);
  }
});

test('every estimated metric names a source and every rough metric says it is a rough estimate', () => {
  for (const metric of [
    'body_fat_pct',
    'fat_mass_kg',
    'lean_mass_kg',
    'water_pct',
    'muscle_pct',
    'bmr_kcal',
  ] as const) {
    expect(EXPLAINERS[metric].formulaSourceIds.length).toBeGreaterThan(0);
  }
  for (const metric of [
    'visceral_rating',
    'bone_mass_kg',
    'protein_pct',
    'metabolic_age',
    'health_score',
  ] as const) {
    expect(EXPLAINERS[metric].reliability).toContain(
      'A rough estimate. No published equation exists for a foot scale.',
    );
  }
});

test('the required facts appear: sources per metric, trend advice, skeletal muscle, not a calorie target', () => {
  expect(EXPLAINERS.body_fat_pct.formulaSourceIds).toEqual(['sun2003', 'gallagher2000']);
  expect(EXPLAINERS.bmi.formulaSourceIds).toEqual(['who2004']);
  expect(EXPLAINERS.bmr_kcal.formulaSourceIds).toEqual(['katchMcArdle', 'mifflin1990']);
  expect(EXPLAINERS.muscle_pct.formulaSourceIds).toEqual(['janssen2000', 'janssen2002']);
  expect(EXPLAINERS.water_pct.formulaSourceIds).toEqual(['sun2003', 'vendor']);
  expect(EXPLAINERS.weight.reliability).toContain('7-day trend');
  expect(EXPLAINERS.muscle_pct.what).toContain('skeletal muscle');
  expect(EXPLAINERS.bmr_kcal.reliability).toContain('not your calorie target');
  expect(EXPLAINERS.body_fat_pct.what).toContain('The share of your weight that is fat');
  expect(EXPLAINERS.body_fat_pct.reliability).toContain('foot-to-foot');
  expect(MOVINGLIFE_NOTE).toContain('not comparable');
});

test('movinglife origin returns no formula sources for body fat', () => {
  expect(explainerSources('body_fat_pct', 'movinglife')).toEqual([]);
  expect(explainerSources('body_fat_pct', 'formula').map((source) => source.id)).toEqual([
    'sun2003',
    'gallagher2000',
  ]);
});

test('derived origin omits Sun but keeps the other sources', () => {
  expect(explainerSources('lean_mass_kg', 'movinglife_derived')).toEqual([]);
  expect(explainerSources('bmr_kcal', 'movinglife_derived').map((source) => source.id)).toEqual([
    'katchMcArdle',
  ]);
  expect(explainerSources('weight', 'scale')).toEqual([]);
});
