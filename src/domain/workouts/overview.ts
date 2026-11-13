import { bucketSeries, fillEmptyBuckets, type SeriesPoint } from '@/domain/series/buckets';
import { addDays, localDateKey, weekStartKey, type DateKey } from '@/domain/time/localDate';

import { exerciseSessions } from './exerciseProgress';
import { buildHeatStrip, groupByWeek, type HeatCell } from './history';
import { workoutVolumeKg } from './metrics';
import { compareWorkouts, type PersonalRecord } from './records';
import type { ScheduledWorkout } from './schedule';
import type { Workout } from './types';

export const OVERVIEW_WEEKS = 8;
export const TOP_LIFT_DAYS = 56;
export const UPCOMING_LIMIT = 5;
/** Weeks the history list shows at first, and adds each time "Show earlier weeks" is tapped. */
export const HISTORY_PAGE_WEEKS = 8;

const DAYS_PER_WEEK = 7;

export type WeekLabel = 'earlier_this_week' | 'last_week' | 'range';

export interface OverviewWeek {
  weekStart: DateKey;
  label: WeekLabel;
  sessions: number;
  volumeKg: number;
  durationS: number | null;
  /** The week's workouts, newest first, without the latest workout (its own card shows it). */
  rows: Workout[];
}

export interface TopLift {
  exerciseId: number;
  name: string;
  latestE1rmKg: number;
  deltaKg: number | null;
  since: DateKey | null;
  /** Per-session best estimated 1-rep max, oldest first. */
  series: number[];
}

export interface WorkoutsOverview {
  thisWeek: { sessions: number; volumeKg: number; durationS: number | null };
  weeklyVolume: SeriesPoint[];
  heat: HeatCell[][];
  latest: Workout | null;
  latestPrCount: number;
  topLift: TopLift | null;
  upcoming: ScheduledWorkout[];
  weeks: OverviewWeek[];
}

function weekLabel(weekStart: DateKey, today: DateKey, latestInThisWeek: boolean): WeekLabel {
  const thisWeek = weekStartKey(today);
  if (weekStart === thisWeek && latestInThisWeek) return 'earlier_this_week';
  if (weekStart === addDays(thisWeek, -DAYS_PER_WEEK)) return 'last_week';
  return 'range';
}

function findTopLift(workouts: readonly Workout[], today: DateKey): TopLift | null {
  const cutoff = addDays(today, -TOP_LIFT_DAYS);
  const ids = new Set(
    workouts
      .filter((w) => localDateKey(w.performedAt) >= cutoff)
      .flatMap((w) => w.exercises.map((e) => e.exerciseId)),
  );

  let best: { exerciseId: number; sessions: ReturnType<typeof exerciseSessions> } | null = null;
  for (const exerciseId of ids) {
    const sessions = exerciseSessions(workouts, exerciseId).filter(
      (s) => s.date >= cutoff && s.bestE1rmKg !== null,
    );
    const last = sessions[sessions.length - 1];
    if (last === undefined) continue;
    const bestLast = best?.sessions[best.sessions.length - 1];
    if (
      best === null ||
      bestLast === undefined ||
      sessions.length > best.sessions.length ||
      (sessions.length === best.sessions.length && last.performedAt > bestLast.performedAt)
    ) {
      best = { exerciseId, sessions };
    }
  }
  if (best === null) return null;

  const series = best.sessions.map((s) => s.bestE1rmKg ?? 0);
  const first = best.sessions[0]!;
  const last = best.sessions[best.sessions.length - 1]!;
  const latestE1rmKg = series[series.length - 1]!;
  const hasChange = series.length >= 2;
  return {
    exerciseId: best.exerciseId,
    name: last.name,
    latestE1rmKg,
    deltaKg: hasChange ? latestE1rmKg - series[0]! : null,
    since: hasChange ? first.date : null,
    series,
  };
}

export function buildWorkoutsOverview(input: {
  workouts: readonly Workout[];
  upcoming: readonly ScheduledWorkout[];
  records: readonly PersonalRecord[];
  today: DateKey;
}): WorkoutsOverview {
  const { workouts, records, today } = input;
  const groups = groupByWeek(workouts);
  const thisWeekStart = weekStartKey(today);
  const current = groups.find((g) => g.weekStart === thisWeekStart);
  const latest = [...workouts].sort(compareWorkouts).pop() ?? null;

  const volumes = workouts.map((w) => ({
    date: localDateKey(w.performedAt),
    value: workoutVolumeKg(w),
  }));
  const weeklyVolume = fillEmptyBuckets(
    bucketSeries(volumes, 'week', 'sum'),
    'week',
    addDays(thisWeekStart, -(OVERVIEW_WEEKS - 1) * DAYS_PER_WEEK),
    today,
  );

  const latestPrSets = new Set(
    records
      .filter((r) => latest !== null && r.lyftaId === latest.lyftaId)
      .map((r) => `${r.exercisePosition}:${r.setPosition}`),
  );
  const latestInThisWeek =
    latest !== null && weekStartKey(localDateKey(latest.performedAt)) === thisWeekStart;

  return {
    thisWeek: {
      sessions: current?.sessions ?? 0,
      volumeKg: current?.volumeKg ?? 0,
      durationS: current?.durationS ?? null,
    },
    weeklyVolume,
    heat: buildHeatStrip(workouts, today),
    latest,
    latestPrCount: latestPrSets.size,
    topLift: findTopLift(workouts, today),
    upcoming: input.upcoming
      .filter((item) => item.date >= today && !item.completed)
      .sort((a, b) =>
        a.date === b.date ? a.title.localeCompare(b.title) : a.date < b.date ? -1 : 1,
      )
      .slice(0, UPCOMING_LIMIT),
    weeks: groups
      .map((group) => ({
        weekStart: group.weekStart,
        label: weekLabel(group.weekStart, today, latestInThisWeek),
        sessions: group.sessions,
        volumeKg: group.volumeKg,
        durationS: group.durationS,
        rows: group.workouts.filter((w) => w.lyftaId !== latest?.lyftaId),
      }))
      .filter((week) => week.rows.length > 0),
  };
}
