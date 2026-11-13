import { addDays, localDateKey, weekStartKey, type DateKey } from '@/domain/time/localDate';
import { workoutVolumeKg } from './metrics';
import type { Workout } from './types';

export interface WeekGroup {
  weekStart: DateKey;
  /** Newest first. */
  workouts: Workout[];
  sessions: number;
  volumeKg: number;
  /** Sum of the known durations; null when none is known. */
  durationS: number | null;
}

export const HEAT_WEEKS = 12;

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatCell {
  date: DateKey;
  volumeKg: number;
  sessions: number;
  level: HeatLevel;
  future: boolean;
}

const DAYS_PER_WEEK = 7;
const MAX_HEAT_LEVEL = 4;

/** Oldest first: by performedAt, then lyftaId (the order records.ts uses). */
export function compareWorkouts(a: Workout, b: Workout): number {
  if (a.performedAt !== b.performedAt) return a.performedAt < b.performedAt ? -1 : 1;
  return a.lyftaId - b.lyftaId;
}

/** Workouts grouped by the Monday-first week of their local day. Newest week and workout first. */
export function groupByWeek(workouts: readonly Workout[]): WeekGroup[] {
  const newestFirst = [...workouts].sort(compareWorkouts).reverse();
  const groups = new Map<DateKey, Workout[]>();
  for (const workout of newestFirst) {
    const weekStart = weekStartKey(localDateKey(workout.performedAt));
    const group = groups.get(weekStart);
    if (group) group.push(workout);
    else groups.set(weekStart, [workout]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([weekStart, inWeek]) => {
      const durations = inWeek.flatMap((w) => (w.durationS === null ? [] : [w.durationS]));
      return {
        weekStart,
        workouts: inWeek,
        sessions: inWeek.length,
        volumeKg: inWeek.reduce((sum, w) => sum + workoutVolumeKg(w), 0),
        durationS: durations.length === 0 ? null : durations.reduce((sum, d) => sum + d, 0),
      };
    });
}

/**
 * `weeks` columns of 7 Monday-to-Sunday cells, oldest column first, the last holding `today`.
 * A day's level is relative to the busiest non-future day in the strip.
 */
export function buildHeatStrip(
  workouts: readonly Workout[],
  today: DateKey,
  weeks: number = HEAT_WEEKS,
): HeatCell[][] {
  const perDay = new Map<DateKey, { volumeKg: number; sessions: number }>();
  for (const workout of workouts) {
    const date = localDateKey(workout.performedAt);
    const day = perDay.get(date) ?? { volumeKg: 0, sessions: 0 };
    day.volumeKg += workoutVolumeKg(workout);
    day.sessions += 1;
    perDay.set(date, day);
  }

  const firstDay = addDays(weekStartKey(today), -(weeks - 1) * DAYS_PER_WEEK);
  const columns = Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: DAYS_PER_WEEK }, (_, offset) => {
      const date = addDays(firstDay, week * DAYS_PER_WEEK + offset);
      const { volumeKg, sessions } = perDay.get(date) ?? { volumeKg: 0, sessions: 0 };
      return { date, volumeKg, sessions, future: date > today };
    }),
  );

  const maxVolumeKg = Math.max(
    0,
    ...columns.flat().map((cell) => (cell.future ? 0 : cell.volumeKg)),
  );

  return columns.map((column) =>
    column.map((cell) => ({ ...cell, level: heatLevel(cell, maxVolumeKg) })),
  );
}

function heatLevel(
  cell: { volumeKg: number; sessions: number; future: boolean },
  maxVolumeKg: number,
): HeatLevel {
  if (cell.future || cell.sessions === 0) return 0;
  if (maxVolumeKg === 0) return 1;
  const level = Math.max(1, Math.ceil((MAX_HEAT_LEVEL * cell.volumeKg) / maxVolumeKg));
  return Math.min(level, MAX_HEAT_LEVEL) as HeatLevel;
}

/** Training days out of the days so far (today counts). */
export function summarizeHeatStrip(columns: readonly HeatCell[][]): {
  trainingDays: number;
  pastDays: number;
} {
  const past = columns.flat().filter((cell) => !cell.future);
  return { trainingDays: past.filter((cell) => cell.sessions > 0).length, pastDays: past.length };
}
