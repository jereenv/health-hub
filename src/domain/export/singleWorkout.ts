import { buildSleepNights } from '@/domain/activity/sleepNights';
import { TIER_LABEL } from '@/domain/body/formatMetric';
import { formatShortDate } from '@/domain/format/dates';
import { formatCount, formatDuration } from '@/domain/format/numbers';
import { formatVolume, formatWeightNumber } from '@/domain/format/units';
import { localDateKey, parseDateKey } from '@/domain/time/localDate';
import { exerciseSessions } from '@/domain/workouts/exerciseProgress';
import { isScoredSet, workoutVolumeKg } from '@/domain/workouts/metrics';
import { computePersonalRecords, prSetKey, prSetKeys } from '@/domain/workouts/records';
import type { WeightUnit, Workout } from '@/domain/workouts/types';

import { originText, valueText } from './bodySection';
import type { BriefingContext } from './buildBriefing';
import { isBodyweightExercise, setText } from './trainingSection';
import type { Prepared } from './prepare';
import type { ExportRequest, SectionText } from './types';

function fullDate(date: string): string {
  return `${formatShortDate(date)} ${parseDateKey(date).year}`;
}

function weighInLine(prep: Prepared, date: string, unit: WeightUnit): string {
  const reading = prep.readings.find((r) => r.date === date && r.metrics.weight);
  const weight = reading?.metrics.weight;
  if (!reading || !weight) return '- No weigh-in that day.';
  let line = `- Weigh-in that day: ${valueText('weight', weight.value, unit)} (${TIER_LABEL[weight.tier]}, ${originText(weight.origin)})`;
  const fat = reading.metrics.body_fat_pct;
  if (fat) {
    line += `; body fat ${valueText('body_fat_pct', fat.value, unit)} (${TIER_LABEL[fat.tier]}, ${originText(fat.origin)})`;
  }
  return `${line} — the first reading of the day.`;
}

function sleepLine(prep: Prepared, date: string): string {
  const night = buildSleepNights(prep.data.sleep).find((n) => n.date === date);
  if (!night) return '- No sleep recorded for that night.';
  return `- Sleep the night before: ${formatDuration(night.asleepS)} (night ending ${formatShortDate(date)}); naps included.`;
}

/** '+5.7 kg vs last time', 'same as last time' or '−2 kg vs last time'. */
function againstLastTime(todayKg: number, lastKg: number, unit: WeightUnit): string {
  const change = formatWeightNumber(Math.abs(todayKg - lastKg), unit);
  if (change === '0') return 'same as last time';
  return `${todayKg > lastKg ? '+' : '−'}${change} ${unit} vs last time`;
}

function lastTimeLines(workout: Workout, prep: Prepared, unit: WeightUnit): string[] {
  const { workouts } = prep.data;
  const seen = new Set<number>();
  const lines: string[] = [];
  const exercises = [...workout.exercises].sort((a, b) => a.position - b.position);
  for (const exercise of exercises) {
    if (seen.has(exercise.exerciseId)) continue;
    seen.add(exercise.exerciseId);
    const sessions = exerciseSessions(workouts, exercise.exerciseId);
    const index = sessions.findIndex((s) => s.lyftaId === workout.lyftaId);
    const current = sessions[index];
    const last = index > 0 ? sessions[index - 1] : undefined;
    if (!current || !last) {
      lines.push(`- ${exercise.name}: first time logged`);
      continue;
    }
    const lastDate = formatShortDate(last.date);
    if (isBodyweightExercise(workouts, exercise.exerciseId)) {
      const best = last.topSet ? `best set BW×${last.topSet.reps}` : 'no weight × reps sets logged';
      lines.push(`- ${exercise.name}: last time ${lastDate}, ${best}`);
      continue;
    }
    const parts = [`last time ${lastDate}`];
    if (last.topSet) parts.push(`top set ${setText({ ...blankSet(), ...last.topSet }, unit)}`);
    if (last.bestE1rmKg !== null) {
      parts.push(`best estimated 1RM ${formatWeightNumber(last.bestE1rmKg, unit)} ${unit}`);
    }
    let line = `- ${exercise.name}: ${parts.join(', ')}`;
    if (current.bestE1rmKg !== null) {
      line += `; today best estimated 1RM ${formatWeightNumber(current.bestE1rmKg, unit)} ${unit}`;
      if (last.bestE1rmKg !== null) {
        line += ` (${againstLastTime(current.bestE1rmKg, last.bestE1rmKg, unit)})`;
      }
    }
    lines.push(line);
  }
  return lines;
}

function blankSet() {
  return {
    position: 0,
    rir: null,
    duration: null,
    distance: null,
    setType: null,
    completed: false,
  };
}

function everySetLines(workout: Workout, prep: Prepared, unit: WeightUnit): string[] {
  const { workouts } = prep.data;
  const keys = prSetKeys(computePersonalRecords(workouts));
  const lines: string[] = [];
  const exercises = [...workout.exercises].sort((a, b) => a.position - b.position);
  for (const exercise of exercises) {
    if (exercise.sets.length === 0) {
      lines.push(`- ${exercise.name}: no sets logged`);
      continue;
    }
    const allowPr = !isBodyweightExercise(workouts, exercise.exerciseId);
    const sets = [...exercise.sets]
      .sort((a, b) => a.position - b.position)
      .filter(isScoredSet)
      .map((set) => {
        const notes = [
          ...(set.rir === null ? [] : [`RIR ${set.rir}`]),
          ...(allowPr && keys.has(prSetKey(workout.lyftaId, exercise.position, set.position))
            ? ['PR']
            : []),
        ];
        return `${setText(set, unit)}${notes.length === 0 ? '' : ` (${notes.join(', ')})`}`;
      });
    lines.push(
      `- ${exercise.name}: ${sets.length === 0 ? 'no weight × reps sets logged' : sets.join(', ')}`,
    );
  }
  return lines;
}

/** The single-workout briefing's parts, or null when the workout is no longer stored. */
export function buildSingleWorkout(
  prep: Prepared,
  request: ExportRequest,
  ctx: BriefingContext,
): (SectionText & { title: string }) | null {
  const workout = prep.data.workouts.find((w) => w.lyftaId === request.workoutId);
  if (!workout) return null;
  const { unit } = ctx;
  const date = localDateKey(workout.performedAt);
  const volume = formatVolume(workoutVolumeKg(workout), unit);
  const duration = workout.durationS === null ? null : formatDuration(workout.durationS);

  const { workouts } = prep.data;
  const setCount = workout.exercises.reduce(
    (sum, exercise) => sum + exercise.sets.filter(isScoredSet).length,
    0,
  );
  const records = computePersonalRecords(workouts).filter(
    (record) =>
      record.lyftaId === workout.lyftaId && !isBodyweightExercise(workouts, record.exerciseId),
  );

  const summary = [
    `- Volume ${volume}; ${formatCount(setCount, 'set')} logged; ${formatCount(records.length, 'personal record')}.`,
  ];
  if (request.sections.body) summary.push(weighInLine(prep, date, unit));
  if (request.sections.sleep) summary.push(sleepLine(prep, date));

  return {
    title: `# Single workout · ${workout.title} · ${fullDate(date)}`,
    context: [
      `- Workout: ${workout.title} on ${formatShortDate(date)} (${duration === null ? '' : `${duration}, `}volume ${volume}).`,
    ],
    summary,
    detail: [
      '### Every set',
      ...everySetLines(workout, prep, unit),
      '',
      '### Last time',
      ...lastTimeLines(workout, prep, unit),
    ],
  };
}
