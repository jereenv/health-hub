import { formatShortDate } from '@/domain/format/dates';
import { formatCount, formatDuration, formatInteger } from '@/domain/format/numbers';
import { formatVolume, formatWeight, formatWeightNumber, kgToUnit } from '@/domain/format/units';
import type { DateKey } from '@/domain/time/localDate';
import { localDateKey } from '@/domain/time/localDate';
import { exerciseSessions } from '@/domain/workouts/exerciseProgress';
import {
  computePersonalRecords,
  compareWorkouts,
  prSetKey,
  prSetKeys,
} from '@/domain/workouts/records';
import type { PersonalRecord } from '@/domain/workouts/records';
import { isScoredSet, workoutVolumeKg } from '@/domain/workouts/metrics';
import type { Workout, WorkoutExercise, WorkoutSet, WeightUnit } from '@/domain/workouts/types';

import { adherence } from './adherence';
import type { Adherence } from './adherence';
import { MISSING, mdTable } from './markdown';
import { inWindow, weekLabel, weekStartsIn, weekWithin } from './period';
import type { Prepared } from './prepare';
import type { DateWindow, PeriodView, SectionText } from './types';

/** On the long level a run of records would outgrow the briefing; only the newest are listed. */
const LONG_LEVEL_MAX_RECORDS = 10;
const MOST_TRAINED_COUNT = 5;
const DAYS_PER_WEEK = 7;

function workoutsIn(workouts: readonly Workout[], window: DateWindow | null): Workout[] {
  if (!window) return [];
  return workouts
    .filter((workout) => inWindow(localDateKey(workout.performedAt), window))
    .sort(compareWorkouts);
}

function totalVolumeKg(workouts: readonly Workout[]): number {
  return workouts.reduce((sum, workout) => sum + workoutVolumeKg(workout), 0);
}

/** The best weight ever logged per exercise, over every scored set; absent when none is scored. */
function bestWeights(workouts: readonly Workout[]): Map<number, number> {
  const best = new Map<number, number>();
  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      for (const set of exercise.sets) {
        if (!isScoredSet(set)) continue;
        const known = best.get(exercise.exerciseId);
        if (known === undefined || set.weightKg > known)
          best.set(exercise.exerciseId, set.weightKg);
      }
    }
  }
  return best;
}

/** Bodyweight: the best logged weight over all history is 0, or no set was ever scored. */
export function isBodyweightExercise(workouts: readonly Workout[], exerciseId: number): boolean {
  const best = bestWeights(workouts).get(exerciseId);
  return best === undefined || best === 0;
}

/** The latest name each exercise was logged under. */
function exerciseNames(workouts: readonly Workout[]): Map<number, string> {
  const names = new Map<number, string>();
  for (const workout of [...workouts].sort(compareWorkouts)) {
    for (const exercise of workout.exercises) names.set(exercise.exerciseId, exercise.name);
  }
  return names;
}

function sessionDuration(workout: Workout): string | null {
  return workout.durationS === null ? null : formatDuration(workout.durationS);
}

function adherenceLine(
  current: Adherence | null,
  previous: Adherence | null,
  hasPrevious: boolean,
): string {
  if (!current) return '- Adherence: no scheduled sessions are stored for this period.';
  let text = `- Adherence: ${current.done} of ${current.scheduled} scheduled sessions done; ${current.missed} missed`;
  if (current.openToday > 0) text += `; ${current.openToday} scheduled today, not yet done`;
  text += '.';
  if (hasPrevious && previous)
    text += ` Previous period: ${previous.done} of ${previous.scheduled}.`;
  return text;
}

function recordLine(
  record: PersonalRecord,
  names: ReadonlyMap<number, string>,
  workoutsById: ReadonlyMap<number, Workout>,
  unit: WeightUnit,
): string {
  const name = names.get(record.exerciseId) ?? 'Exercise';
  const date = formatShortDate(localDateKey(workoutsById.get(record.lyftaId)!.performedAt));
  const what = record.kind === 'weight' ? 'weight' : 'estimated 1RM';
  return `${name} ${what} ${formatWeight(record.valueKg, unit)} (previous best ${formatWeight(record.previousKg, unit)}) on ${date}`;
}

/** Ruling 7: this period's best estimated 1RM against the best before the period began. */
export function oneRepMaxState(
  periodBestKg: number,
  earlierBestKg: number | null,
  unit: WeightUnit,
): string {
  if (earlierBestKg === null) return 'first time logged';
  const change = formatWeightNumber(periodBestKg - earlierBestKg, unit);
  if (change === '0') return 'no change';
  if (periodBestKg > earlierBestKg) return `new best +${change} ${unit}`;
  return `below earlier best ${formatWeight(earlierBestKg, unit)}`;
}

function bestE1rm(sessions: readonly { bestE1rmKg: number | null }[]): number | null {
  const values = sessions.flatMap((s) => (s.bestE1rmKg === null ? [] : [s.bestE1rmKg]));
  return values.length === 0 ? null : Math.max(...values);
}

function oneRepMaxLine(
  all: readonly Workout[],
  inPeriod: readonly Workout[],
  window: DateWindow,
  unit: WeightUnit,
  names: ReadonlyMap<number, string>,
  best: ReadonlyMap<number, number>,
): string | null {
  const ids = new Set(inPeriod.flatMap((w) => w.exercises.map((e) => e.exerciseId)));
  // Nothing can be "earlier" when the window starts on or before the first training day (always
  // so for a journey), so no lift is compared and none is called new.
  const firstTrainingDay = all.map((w) => localDateKey(w.performedAt)).sort()[0];
  const hasBaseline = firstTrainingDay !== undefined && window.from > firstTrainingDay;
  const entries: { name: string; text: string }[] = [];
  for (const id of ids) {
    if ((best.get(id) ?? 0) === 0) continue;
    const sessions = exerciseSessions(all, id);
    const periodBest = bestE1rm(sessions.filter((s) => inWindow(s.date, window)));
    // A lift done bodyweight-only in the period has an estimate of 0; that says nothing.
    if (periodBest === null || periodBest === 0) continue;
    const name = names.get(id) ?? 'Exercise';
    const shown = formatWeight(periodBest, unit);
    const earlierBest = bestE1rm(sessions.filter((s) => s.date < window.from));
    entries.push({
      name,
      text: hasBaseline
        ? `${name} ${shown} (${oneRepMaxState(periodBest, earlierBest, unit)})`
        : `${name} ${shown}`,
    });
  }
  if (entries.length === 0) return null;
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const heading = hasBaseline
    ? 'Best estimated 1-rep max (Epley, sets of 1–12 reps) this period vs all earlier'
    : 'Best estimated 1-rep max (Epley, sets of 1–12 reps) this period';
  return `- ${heading}: ${entries.map((e) => e.text).join('; ')}.`;
}

function mostTrainedLine(
  all: readonly Workout[],
  inPeriod: readonly Workout[],
  window: DateWindow,
  unit: WeightUnit,
  names: ReadonlyMap<number, string>,
  best: ReadonlyMap<number, number>,
): string | null {
  const ids = new Set(inPeriod.flatMap((w) => w.exercises.map((e) => e.exerciseId)));
  const lifts = [...ids]
    .filter((id) => (best.get(id) ?? 0) > 0)
    .map((id) => ({
      id,
      name: names.get(id) ?? 'Exercise',
      sessions: exerciseSessions(all, id).filter((s) => inWindow(s.date, window)),
    }))
    .sort((a, b) => b.sessions.length - a.sessions.length || (a.name < b.name ? -1 : 1))
    .slice(0, MOST_TRAINED_COUNT);
  if (lifts.length === 0) return null;
  const entries = lifts.map(({ name, sessions }) => {
    const e1rms = sessions.flatMap((s) => (s.bestE1rmKg === null ? [] : [s.bestE1rmKg]));
    const weights = sessions.flatMap((s) => (s.bestWeightKg === null ? [] : [s.bestWeightKg]));
    const parts = [formatCount(sessions.length, 'session')];
    if (e1rms.length > 0) {
      const first = formatWeightNumber(e1rms[0]!, unit);
      const now = formatWeightNumber(e1rms[e1rms.length - 1]!, unit);
      parts.push(`e1RM ${first} → ${now} ${unit}`);
    }
    if (weights.length > 0) {
      parts.push(`best weight ${formatWeight(Math.max(...weights), unit)}`);
    }
    return `${name} (${parts.join(', ')})`;
  });
  return `- Most-trained lifts: ${entries.join('; ')}.`;
}

function summaryLines(prep: Prepared, view: PeriodView): string[] {
  const { workouts, schedule } = prep.data;
  const unit = view.unit;
  const lines: string[] = ['### Training'];
  const current = workoutsIn(workouts, view.window);
  const names = exerciseNames(workouts);
  const best = bestWeights(workouts);

  if (current.length === 0) {
    lines.push('- No workouts logged in this period.');
  } else if (view.preset === 'journey') {
    const weeks = view.days / DAYS_PER_WEEK;
    lines.push(
      `- Workouts logged: ${current.length} over ${weeks.toFixed(1)} weeks (${(current.length / weeks).toFixed(1)} per week); total volume ${formatVolume(totalVolumeKg(current), unit)}.`,
    );
  } else {
    const previous = workoutsIn(workouts, view.previous);
    const previousVolume =
      previous.length === 0 ? 'none' : formatVolume(totalVolumeKg(previous), unit);
    lines.push(
      `- Workouts logged: ${current.length} (previous period ${previous.length}); volume ${formatVolume(totalVolumeKg(current), unit)} (previous ${previousVolume}).`,
    );
  }

  const hasPrevious = view.preset !== 'journey' && view.previous !== null;
  lines.push(
    adherenceLine(
      adherence(schedule, workouts, view.window, view.today),
      hasPrevious && view.previous
        ? adherence(schedule, workouts, view.previous, view.today)
        : null,
      hasPrevious,
    ),
  );

  if (current.length === 0) return lines;

  const byId = new Map(workouts.map((workout) => [workout.lyftaId, workout]));
  const records = computePersonalRecords(workouts).filter((record) => {
    const workout = byId.get(record.lyftaId);
    return (
      workout !== undefined &&
      inWindow(localDateKey(workout.performedAt), view.window) &&
      (best.get(record.exerciseId) ?? 0) > 0
    );
  });
  if (records.length > 0) {
    const shown = view.level === 'long' ? records.slice(-LONG_LEVEL_MAX_RECORDS) : records;
    const heading =
      shown.length < records.length
        ? `Personal records this period (latest ${shown.length} of ${records.length})`
        : 'Personal records this period';
    lines.push(`- ${heading}: ${shown.map((r) => recordLine(r, names, byId, unit)).join('; ')}.`);
  }

  const e1rm = oneRepMaxLine(workouts, current, view.window, unit, names, best);
  if (e1rm) lines.push(e1rm);
  if (view.preset === 'journey') {
    const lifts = mostTrainedLine(workouts, current, view.window, unit, names, best);
    if (lifts) lines.push(lifts);
  }
  return lines;
}

/** '80×5', or 'BW×8' for a weight-0 set. Only scored sets are shown. */
export function setText(
  set: WorkoutSet & { weightKg: number; reps: number },
  unit: WeightUnit,
): string {
  return `${set.weightKg === 0 ? 'BW' : formatWeightNumber(set.weightKg, unit)}×${set.reps}`;
}

/** One exercise's sets as "80×5, 85×5, 90×3 (PR)". */
export function setsText(
  exercise: WorkoutExercise,
  unit: WeightUnit,
  prKeys: ReadonlySet<string>,
  lyftaId: number,
  allowPr: boolean,
): string {
  if (exercise.sets.length === 0) return 'no sets logged';
  const parts = [...exercise.sets]
    .sort((a, b) => a.position - b.position)
    .filter(isScoredSet)
    .map((set) => {
      const isPr = allowPr && prKeys.has(prSetKey(lyftaId, exercise.position, set.position));
      return `${setText(set, unit)}${isPr ? ' (PR)' : ''}`;
    });
  return parts.length === 0 ? 'no weight × reps sets logged' : parts.join(', ');
}

function workoutHeading(workout: Workout, unit: WeightUnit): string {
  const duration = sessionDuration(workout);
  return [
    formatShortDate(localDateKey(workout.performedAt)),
    workout.title,
    ...(duration === null ? [] : [duration]),
    `volume ${formatVolume(workoutVolumeKg(workout), unit)}`,
  ].join(' · ');
}

function workoutSummaryLine(workout: Workout, unit: WeightUnit): string {
  const duration = sessionDuration(workout);
  return `- ${[
    formatShortDate(localDateKey(workout.performedAt)),
    workout.title,
    ...(duration === null ? [] : [duration]),
    formatVolume(workoutVolumeKg(workout), unit),
  ].join(' · ')}`;
}

function detailLines(prep: Prepared, view: PeriodView): string[] {
  if (view.level === 'long') return [];
  const { workouts } = prep.data;
  const current = workoutsIn(workouts, view.window);
  if (current.length === 0) return [];
  const unit = view.unit;

  if (view.level === 'medium') {
    const columns = trainingWeeklyColumns(prep, view);
    const rows = weekStartsIn(view.window).map((week) => [
      weekLabel(week, view),
      ...(columns.byWeek.get(week) ?? []),
    ]);
    return [
      '### Workouts',
      ...mdTable(['Week of', ...columns.headers], rows),
      '',
      ...current.map((workout) => workoutSummaryLine(workout, unit)),
    ];
  }

  const best = bestWeights(workouts);
  const keys = prSetKeys(computePersonalRecords(workouts));
  const out: string[] = ['### Workouts'];
  current.forEach((workout, index) => {
    if (index > 0) out.push('');
    out.push(`#### ${workoutHeading(workout, unit)}`);
    const exercises = [...workout.exercises].sort((a, b) => a.position - b.position);
    for (const exercise of exercises) {
      const allowPr = (best.get(exercise.exerciseId) ?? 0) > 0;
      out.push(`- ${exercise.name}: ${setsText(exercise, unit, keys, workout.lyftaId, allowPr)}`);
    }
  });
  return out;
}

export function buildTrainingSection(prep: Prepared, view: PeriodView): SectionText {
  return { context: [], summary: summaryLines(prep, view), detail: detailLines(prep, view) };
}

/** Sessions, volume, scheduled and done for each Monday-start week touching the window. */
export function trainingWeeklyColumns(
  prep: Prepared,
  view: PeriodView,
): { headers: string[]; byWeek: ReadonlyMap<DateKey, string[]> } {
  const { workouts, schedule } = prep.data;
  const byWeek = new Map<DateKey, string[]>();
  for (const week of weekStartsIn(view.window)) {
    const days = weekWithin(week, view.window);
    const inWeek = workoutsIn(workouts, days);
    const plan = adherence(schedule, workouts, days, view.today);
    byWeek.set(week, [
      String(inWeek.length),
      inWeek.length === 0
        ? MISSING
        : formatInteger(Math.round(kgToUnit(totalVolumeKg(inWeek), view.unit))),
      plan ? String(plan.scheduled) : MISSING,
      plan ? String(plan.done) : MISSING,
    ]);
  }
  return { headers: ['Sessions', `Volume (${view.unit})`, 'Scheduled', 'Done'], byWeek };
}
