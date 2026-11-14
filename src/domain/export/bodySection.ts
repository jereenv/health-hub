import { ROW_ORDER } from '@/domain/body/bodyOverview';
import { fatVsLean } from '@/domain/body/fatVsLean';
import { formatMetricChange, formatMetricValue, TIER_LABEL } from '@/domain/body/formatMetric';
import { FORMULA_VERSION } from '@/domain/body/formulas';
import { weeklyLossRate } from '@/domain/body/lossRate';
import { dayPoints } from '@/domain/body/series';
import type { DayPoint } from '@/domain/body/series';
import { FORMULA_SOURCES } from '@/domain/body/sources';
import { METRIC_META, isLegacyOrigin } from '@/domain/body/types';
import type { MetricId, Origin } from '@/domain/body/types';
import { formatShortDate } from '@/domain/format/dates';
import { kgToUnit } from '@/domain/format/units';
import type { DateKey } from '@/domain/time/localDate';
import { addDays, localDateKey, ageOn } from '@/domain/time/localDate';
import { formatCount } from '@/domain/format/numbers';
import type { WeightUnit } from '@/domain/workouts/types';

import { MISSING, dayLabel, mdTable, mean } from './markdown';
import { datesIn, headlineWindow, inWindow, weekStartsIn, weekWithin } from './period';
import type { Prepared } from './prepare';
import type { DateWindow, PeriodView, SectionText } from './types';

/** Weight first, then the Body page's order. */
const METRIC_ORDER: readonly MetricId[] = ['weight', ...ROW_ORDER];

/** Impedance-only metrics: absent for MovingLife readings. */
const IMPEDANCE_ONLY: readonly { id: MetricId; name: string }[] = [
  { id: 'water_pct', name: 'body water' },
  { id: 'muscle_pct', name: 'muscle' },
  { id: 'bone_mass_kg', name: 'bone mass' },
  { id: 'protein_pct', name: 'protein' },
  { id: 'visceral_rating', name: 'visceral fat' },
  { id: 'metabolic_age', name: 'metabolic age' },
  { id: 'health_score', name: 'health score' },
];

/** Which published sources a formula-origin metric rests on (BMR is decided per reading). */
const FORMULA_SOURCE_IDS: Partial<Record<MetricId, string>> = {
  body_fat_pct: 'sun2003',
  fat_mass_kg: 'sun2003',
  lean_mass_kg: 'sun2003',
  water_pct: 'sun2003',
  muscle_pct: 'janssen2000',
  bone_mass_kg: 'openscale',
  protein_pct: 'vendor',
  visceral_rating: 'vendor',
  metabolic_age: 'vendor',
  health_score: 'vendor',
};

const LAST_DAYS_TABLE = 14;

export function originText(origin: Origin): string {
  switch (origin) {
    case 'scale':
      return 'scale';
    case 'formula':
      return `Health Hub formula v${FORMULA_VERSION}`;
    case 'movinglife':
      return "MovingLife's own figure";
    case 'movinglife_derived':
      return 'derived from MovingLife body fat';
  }
}

export function valueText(metric: MetricId, value: number, unit: WeightUnit): string {
  const shown = formatMetricValue(metric, value, unit);
  return shown.unit === '' ? shown.value : `${shown.value} ${shown.unit}`;
}

function isHollow(point: DayPoint): boolean {
  return isLegacyOrigin(point.origin);
}

interface BodyModel {
  /** Day points per metric up to the period's end, ascending. */
  points: Map<MetricId, DayPoint[]>;
  tierOf: (metric: MetricId, point: DayPoint) => string;
  window: DateWindow;
}

function buildModel(prep: Prepared, view: PeriodView): BodyModel {
  const byId = new Map(prep.readings.map((reading) => [reading.id, reading]));
  const points = new Map<MetricId, DayPoint[]>();
  for (const metric of METRIC_ORDER) {
    points.set(
      metric,
      dayPoints(prep.readings, metric).filter((point) => point.date <= view.window.to),
    );
  }
  return {
    points,
    window: view.window,
    tierOf: (metric, point) => {
      const tier = byId.get(point.readingId)?.metrics[metric]?.tier;
      return tier ? TIER_LABEL[tier] : '';
    },
  };
}

function pointsOf(model: BodyModel, metric: MetricId): DayPoint[] {
  return model.points.get(metric) ?? [];
}

function within(points: readonly DayPoint[], window: DateWindow | null): DayPoint[] {
  return window ? points.filter((point) => inWindow(point.date, window)) : [];
}

function pointMean(points: readonly DayPoint[]): number | null {
  return mean(points.map((point) => point.value));
}

function previousName(view: PeriodView): string {
  return view.comparisonLabel;
}

interface MetricLine {
  line: string;
  note: string | null;
}

function metricLine(model: BodyModel, view: PeriodView, metric: MetricId): MetricLine | null {
  const inPeriod = within(pointsOf(model, metric), view.window);
  const latest = inPeriod[inPeriod.length - 1];
  if (!latest) return null;
  const hollow = isHollow(latest);
  const sameMethod = (point: DayPoint): boolean => isHollow(point) === hollow;

  const headline = headlineWindow(view);
  const current = within(pointsOf(model, metric), headline);
  const currentSame = current.filter(sameMethod);
  const previous = within(pointsOf(model, metric), view.previous);
  const previousSame = previous.filter(sameMethod);

  const label = METRIC_META[metric].label;
  const head = `- ${label} (${model.tierOf(metric, latest)}, ${originText(latest.origin)}): `;
  const scope = view.preset === 'journey' ? ' in the last 7 days' : '';
  const currentMean = pointMean(currentSame);
  const nowText =
    currentMean === null
      ? `no weigh-ins${scope}`
      : `${valueText(metric, currentMean, view.unit)} mean of ${formatCount(currentSame.length, 'weigh-in day')}${scope}`;

  const name = previousName(view);
  let comparison: string;
  if (view.previous === null) comparison = '';
  else if (previous.length === 0) {
    comparison =
      view.preset === 'journey'
        ? '; no weigh-ins in the first 7 days'
        : '; no weigh-ins in the previous period';
  } else if (previousSame.length === 0) {
    comparison = '; previous period used a different method; not compared';
  } else {
    const previousMean = pointMean(previousSame) as number;
    comparison = `; ${name} ${valueText(metric, previousMean, view.unit)} (${formatCount(previousSame.length, 'day')})`;
    if (currentMean !== null) {
      comparison += `; change ${formatMetricChange(metric, currentMean - previousMean, view.unit)}`;
    }
  }

  const otherCurrent = current.length - currentSame.length;
  const otherPrevious = previous.length - previousSame.length;
  const noteParts: string[] = [];
  if (otherCurrent > 0) {
    noteParts.push(`${formatCount(otherCurrent, 'day')} of another method in this period`);
  }
  if (previousSame.length > 0 && otherPrevious > 0) {
    noteParts.push(`${formatCount(otherPrevious, 'day')} of another method in the comparison`);
  }
  return {
    line: `${head}${nowText}${comparison}.`,
    note:
      noteParts.length === 0
        ? null
        : `- Method note, ${label}: ${noteParts.join(' and ')} not averaged.`,
  };
}

function lossRateLine(model: BodyModel, view: PeriodView): string | null {
  const rate = weeklyLossRate(pointsOf(model, 'weight'), view.window.to);
  if (!rate) return null;
  const perWeek = kgToUnit(rate.kgPerWeek, view.unit);
  const amount = `${perWeek < 0 ? '−' : ''}${Math.abs(perWeek).toFixed(2)}`;
  const percent = `${rate.percentPerWeek < 0 ? '−' : ''}${Math.abs(rate.percentPerWeek).toFixed(2)}`;
  const status = rate.status.charAt(0).toUpperCase() + rate.status.slice(1);
  return `- Loss rate: ${amount} ${view.unit}/week (${percent} % of body weight per week, last 28 days, healthy band 0.5–1 %) — ${status}.`;
}

function fatVsLeanLine(model: BodyModel, view: PeriodView): string | null {
  const result = fatVsLean(
    pointsOf(model, 'fat_mass_kg'),
    pointsOf(model, 'lean_mass_kg'),
    view.window.to,
  );
  if (!result) return null;
  const fat = formatMetricChange('fat_mass_kg', result.fatChangeKg, view.unit);
  const lean = formatMetricChange('lean_mass_kg', result.leanChangeKg, view.unit);
  return `- Fat vs lean over the last 30 days: fat ${fat}, lean ${lean}${result.hollow ? ' (MovingLife-derived)' : ''}.`;
}

function goalLine(prep: Prepared, view: PeriodView, latestWeightKg: number | null): string | null {
  const goal = prep.profile?.goalWeightKg ?? null;
  if (goal === null || latestWeightKg === null) return null;
  const difference = kgToUnit(latestWeightKg - goal, view.unit);
  const amount = valueText('weight', Math.abs(latestWeightKg - goal), view.unit);
  const detail = `(${valueText('weight', latestWeightKg, view.unit)} vs ${valueText('weight', goal, view.unit)})`;
  if (Math.abs(difference).toFixed(1) === '0.0') return `- Goal: at goal weight ${detail}.`;
  return `- Goal: ${amount} ${difference > 0 ? 'above' : 'below'} goal weight ${detail}.`;
}

function watchByDate(prep: Prepared, window: DateWindow): Map<DateKey, number[]> {
  const byDate = new Map<DateKey, number[]>();
  for (const check of prep.data.watch) {
    const date = localDateKey(check.measuredAt);
    if (!inWindow(date, window)) continue;
    const group = byDate.get(date);
    if (group) group.push(check.bodyFatPct);
    else byDate.set(date, [check.bodyFatPct]);
  }
  return byDate;
}

function watchLine(prep: Prepared, window: DateWindow): string | null {
  const byDate = watchByDate(prep, window);
  const all = [...byDate.values()].flat();
  const average = mean(all);
  if (average === null) return null;
  return `- Watch body-fat checks (Galaxy Watch, separate from the scale; not blended): ${formatCount(all.length, 'check')} on ${formatCount(byDate.size, 'day')}, mean of the checks ${average.toFixed(1)} %.`;
}

function contextLines(prep: Prepared, view: PeriodView, model: BodyModel): string[] {
  const span: DateWindow = view.previous
    ? {
        from: view.previous.from < view.window.from ? view.previous.from : view.window.from,
        to: view.window.to,
      }
    : view.window;
  const used = METRIC_ORDER.flatMap((metric) =>
    within(pointsOf(model, metric), span).map((point) => ({ metric, point })),
  );
  const hasWatch = watchByDate(prep, view.window).size > 0;
  if (used.length === 0 && !hasWatch) return [];

  const lines: string[] = [];
  if (used.length > 0) {
    lines.push(
      '- Body: each day\'s value is that day\'s first weigh-in. Averages are means of those daily values, and "latest" is the latest single reading. A single reading can swing by several points on a foot-to-foot scale, so an average says more than one weigh-in.',
      "- Body tiers: Measured = read by the scale; Exact = plain arithmetic on measured values (BMI); Estimated = from a published equation or MovingLife's own estimate; Rough = a heuristic with no published equation for a foot-to-foot scale.",
    );
    if (used.some(({ point }) => isHollow(point))) {
      lines.push(
        '- MovingLife: its body fat is that app\'s own estimate, not computed here. Fat mass, lean mass and BMR built on it are marked "derived from MovingLife body fat". It is a different method from the Health Hub formula, so the two are never averaged together.',
      );
    }
    const sourceIds = new Set<string>();
    for (const { metric, point } of used) {
      if (point.origin !== 'formula' || metric === 'bmi') continue;
      if (metric === 'bmr_kcal') {
        const reading = prep.readings.find((r) => r.id === point.readingId);
        sourceIds.add(
          reading?.metrics.lean_mass_kg?.origin === 'formula' ? 'katchMcArdle' : 'mifflin1990',
        );
      } else {
        const id = FORMULA_SOURCE_IDS[metric];
        if (id) sourceIds.add(id);
      }
    }
    if (sourceIds.size > 0) {
      const names = FORMULA_SOURCES.filter((source) => sourceIds.has(source.id)).map(
        (source) => source.short,
      );
      lines.push(
        `- Body-composition formulas: Health Hub version ${FORMULA_VERSION} (${names.join('; ')}).`,
      );
    } else {
      lines.push(
        `- Body-composition formulas: Health Hub version ${FORMULA_VERSION}; no body-composition value in this briefing was computed by them (all body fat is MovingLife's own).`,
      );
    }
  }
  if (hasWatch) {
    lines.push(
      '- Watch body-fat checks come from the Galaxy Watch, a different instrument from the scale. They are listed separately and never blended into the scale figures.',
    );
  }
  return lines;
}

function summaryLines(prep: Prepared, view: PeriodView, model: BodyModel): string[] {
  const lines: string[] = ['### Body'];
  const weightPeriod = within(pointsOf(model, 'weight'), view.window);
  const watch = watchLine(prep, view.window);
  if (
    weightPeriod.length === 0 &&
    within(pointsOf(model, 'body_fat_pct'), view.window).length === 0
  ) {
    lines.push('- No weigh-ins in this period.');
    if (watch) lines.push(watch);
    return lines;
  }

  const notes: string[] = [];
  for (const metric of METRIC_ORDER) {
    const result = metricLine(model, view, metric);
    if (!result) continue;
    lines.push(result.line);
    if (result.note) notes.push(result.note);
  }

  const latestReading = [...prep.readings]
    .reverse()
    .find((reading) => reading.metrics.weight && inWindow(reading.date, view.window));
  const latestWeight = latestReading?.metrics.weight;
  if (latestReading && latestWeight) {
    lines.push(
      `- Latest weigh-in: ${valueText('weight', latestWeight.value, view.unit)} on ${formatShortDate(latestReading.date)} (a single reading, not an average).`,
    );
  }
  const loss = lossRateLine(model, view);
  if (loss) lines.push(loss);
  const split = fatVsLeanLine(model, view);
  if (split) lines.push(split);
  const goal = goalLine(prep, view, latestWeight?.value ?? null);
  if (goal) lines.push(goal);

  const legacyAppears = METRIC_ORDER.some((metric) =>
    within(pointsOf(model, metric), view.window).some(isHollow),
  );
  if (legacyAppears) {
    const missing = IMPEDANCE_ONLY.filter(
      ({ id }) => within(pointsOf(model, id), view.window).length === 0,
    ).map(({ name }) => name);
    if (missing.length > 0) {
      lines.push(
        `- Not available for MovingLife readings (they need scale impedance, which those readings lack): ${missing.join(', ')}.`,
      );
    }
  }
  lines.push(...notes);
  if (watch) lines.push(watch);
  return lines;
}

function tableWindow(view: PeriodView): DateWindow {
  if (view.level !== 'long') return view.window;
  const from = addDays(view.window.to, -(LAST_DAYS_TABLE - 1));
  return { from: from < view.window.from ? view.window.from : from, to: view.window.to };
}

function sourceCell(point: DayPoint | undefined): string {
  if (!point) return MISSING;
  return isHollow(point) ? 'MovingLife' : 'Health Hub formula';
}

function detailLines(prep: Prepared, view: PeriodView, model: BodyModel): string[] {
  const window = tableWindow(view);
  const byDate = (metric: MetricId): Map<DateKey, DayPoint> =>
    new Map(within(pointsOf(model, metric), window).map((point) => [point.date, point]));
  const weight = byDate('weight');
  const fat = byDate('body_fat_pct');
  const fatMass = byDate('fat_mass_kg');
  const lean = byDate('lean_mass_kg');
  const water = byDate('water_pct');
  const muscle = byDate('muscle_pct');

  const out: string[] = [];
  if (weight.size > 0 || fat.size > 0) {
    const unit = view.unit;
    const extra: { header: string; metric: MetricId; points: Map<DateKey, DayPoint> }[] = [];
    if (water.size > 0)
      extra.push({ header: 'Body water (%)', metric: 'water_pct', points: water });
    if (muscle.size > 0) extra.push({ header: 'Muscle (%)', metric: 'muscle_pct', points: muscle });
    const cell = (metric: MetricId, point: DayPoint | undefined): string =>
      point ? formatMetricValue(metric, point.value, unit).value : MISSING;
    const rows = datesIn(window).map((date) => [
      dayLabel(date, view.today),
      cell('weight', weight.get(date)),
      cell('body_fat_pct', fat.get(date)),
      cell('fat_mass_kg', fatMass.get(date)),
      cell('lean_mass_kg', lean.get(date)),
      ...extra.map((column) => cell(column.metric, column.points.get(date))),
      sourceCell(fat.get(date)),
    ]);
    out.push(
      view.level === 'long'
        ? `### Body — last ${LAST_DAYS_TABLE} days (each day's first weigh-in)`
        : "### Body — daily (each day's first weigh-in)",
      ...mdTable(
        [
          'Date',
          `Weight (${unit})`,
          'Body fat (%)',
          `Fat mass (${unit})`,
          `Lean mass (${unit})`,
          ...extra.map((column) => column.header),
          'Body-fat source',
        ],
        rows,
      ),
    );
  }

  const checks = watchByDate(prep, window);
  if (checks.size > 0) {
    if (out.length > 0) out.push('');
    out.push(
      '### Watch body-fat checks (Galaxy Watch; separate from the scale)',
      ...mdTable(
        ['Date', 'Body fat (%)'],
        [...checks.keys()]
          .sort()
          .map((date) => [
            dayLabel(date, view.today),
            (mean(checks.get(date) as number[]) as number).toFixed(1),
          ]),
      ),
    );
  }
  return out;
}

export function buildBodySection(prep: Prepared, view: PeriodView): SectionText {
  const model = buildModel(prep, view);
  return {
    context: contextLines(prep, view, model),
    summary: summaryLines(prep, view, model),
    detail: detailLines(prep, view, model),
  };
}

/** For the weekly table of the medium/long levels: weigh-in days, weight and body fat. */
export function bodyWeeklyColumns(
  prep: Prepared,
  view: PeriodView,
): { headers: string[]; byWeek: ReadonlyMap<DateKey, string[]> } {
  const model = buildModel(prep, view);
  const weight = within(pointsOf(model, 'weight'), view.window);
  const fat = within(pointsOf(model, 'body_fat_pct'), view.window);
  const latestWeight = weight[weight.length - 1];
  const latestFat = fat[fat.length - 1];
  const sameAs = (latest: DayPoint | undefined) => (point: DayPoint) =>
    latest === undefined || isHollow(point) === isHollow(latest);

  const byWeek = new Map<DateKey, string[]>();
  for (const week of weekStartsIn(view.window)) {
    const days = weekWithin(week, view.window);
    const weekWeight = weight.filter((p) => inWindow(p.date, days)).filter(sameAs(latestWeight));
    const weekFat = fat.filter((p) => inWindow(p.date, days)).filter(sameAs(latestFat));
    const weightMean = pointMean(weekWeight);
    const fatMean = pointMean(weekFat);
    byWeek.set(week, [
      weekWeight.length === 0 ? MISSING : String(weekWeight.length),
      weightMean === null ? MISSING : formatMetricValue('weight', weightMean, view.unit).value,
      fatMean === null ? MISSING : formatMetricValue('body_fat_pct', fatMean, view.unit).value,
    ]);
  }
  return { headers: ['Weigh-in days', `Weight (${view.unit})`, 'Body fat (%)'], byWeek };
}

/** The person line of the Context block: sex, age, height. Used by the assembler. */
export function personLine(prep: Prepared, today: DateKey, unit: WeightUnit): string | null {
  const profile = prep.profile;
  if (!profile) return null;
  const parts: string[] = [];
  if (profile.sex) parts.push(profile.sex);
  if (profile.birthDate) parts.push(`${ageOn(profile.birthDate, today)} years`);
  if (profile.heightCm !== null) parts.push(`${Math.round(profile.heightCm)} cm`);
  const sentences: string[] = [];
  if (parts.length > 0) sentences.push(`${parts.join(', ')}.`);
  if (profile.goalWeightKg !== null) {
    sentences.push(`Goal weight ${valueText('weight', profile.goalWeightKg, unit)}.`);
  }
  return sentences.length === 0 ? null : `- Person: ${sentences.join(' ')}`;
}
