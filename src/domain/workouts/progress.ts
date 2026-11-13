import {
  bucketSeries,
  fillEmptyBuckets,
  type DatedValue,
  type RangeKind,
  type SeriesPoint,
} from '@/domain/series/buckets';
import { addDays, weekStartKey, type DateKey } from '@/domain/time/localDate';

import { exerciseSessions, type ExerciseSession } from './exerciseProgress';
import type { Workout } from './types';

/** Days (day range) or weeks (week range) shown; the month range shows all history. */
export const RANGE_WINDOWS = { day: 30, week: 12 } as const;
const RECENT_SESSIONS = 10;
const DAYS_PER_WEEK = 7;

export interface ExerciseProgress {
  exerciseId: number;
  name: string;
  sessions: number;
  lastDate: DateKey;
  bestWeight: { kg: number; date: DateKey } | null;
  bestE1rm: { kg: number; date: DateKey; weightKg: number; reps: number } | null;
  /** Sparse: a week without the exercise is not a 1-rep max of zero. */
  e1rmSeries: SeriesPoint[];
  /** Zero-filled for the week and month ranges. */
  volumeSeries: SeriesPoint[];
  /** The 10 newest sessions, newest first. */
  recent: ExerciseSession[];
}

function windowStart(range: RangeKind, first: DateKey, today: DateKey): DateKey {
  if (range === 'day') return addDays(today, -(RANGE_WINDOWS.day - 1));
  if (range === 'week') {
    return addDays(weekStartKey(today), -(RANGE_WINDOWS.week - 1) * DAYS_PER_WEEK);
  }
  return first;
}

export function buildExerciseProgress(
  workouts: readonly Workout[],
  exerciseId: number,
  range: RangeKind,
  today: DateKey,
): ExerciseProgress | null {
  const sessions = exerciseSessions(workouts, exerciseId);
  const last = sessions[sessions.length - 1];
  const first = sessions[0];
  if (last === undefined || first === undefined) return null;

  let bestWeight: ExerciseProgress['bestWeight'] = null;
  let bestE1rm: ExerciseProgress['bestE1rm'] = null;
  for (const session of sessions) {
    if (
      session.bestWeightKg !== null &&
      (bestWeight === null || session.bestWeightKg > bestWeight.kg)
    ) {
      bestWeight = { kg: session.bestWeightKg, date: session.date };
    }
    if (session.bestE1rmKg !== null && session.e1rmSet !== null) {
      if (bestE1rm === null || session.bestE1rmKg > bestE1rm.kg) {
        bestE1rm = { kg: session.bestE1rmKg, date: session.date, ...session.e1rmSet };
      }
    }
  }

  const from = windowStart(range, first.date, today);
  const inWindow = sessions.filter((s) => s.date >= from);
  const e1rmValues: DatedValue[] = inWindow.flatMap((s) =>
    s.bestE1rmKg === null ? [] : [{ date: s.date, value: s.bestE1rmKg }],
  );
  const volumeSeries = bucketSeries(
    inWindow.map((s) => ({ date: s.date, value: s.volumeKg })),
    range,
    'sum',
  );

  return {
    exerciseId,
    name: last.name,
    sessions: sessions.length,
    lastDate: last.date,
    bestWeight,
    bestE1rm,
    e1rmSeries: bucketSeries(e1rmValues, range, 'max'),
    volumeSeries:
      range === 'day' ? volumeSeries : fillEmptyBuckets(volumeSeries, range, from, today),
    recent: sessions.slice(-RECENT_SESSIONS).reverse(),
  };
}
