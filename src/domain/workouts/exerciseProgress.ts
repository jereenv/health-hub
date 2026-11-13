import { localDateKey, type DateKey } from '@/domain/time/localDate';
import { compareWorkouts } from './history';
import { estimateOneRepMaxKg, isScoredSet, type ScoredSet } from './metrics';
import type { Workout } from './types';

export interface ExerciseSession {
  lyftaId: number;
  performedAt: string;
  date: DateKey;
  /** The exercise's name as recorded in this workout. */
  name: string;
  scoredSets: number;
  volumeKg: number;
  bestWeightKg: number | null;
  bestE1rmKg: number | null;
  topSet: { weightKg: number; reps: number } | null;
}

/** One session per workout containing the exercise, oldest first. Repeated entries are merged. */
export function exerciseSessions(
  workouts: readonly Workout[],
  exerciseId: number,
): ExerciseSession[] {
  const sessions: ExerciseSession[] = [];

  for (const workout of [...workouts].sort(compareWorkouts)) {
    const entries = workout.exercises
      .filter((exercise) => exercise.exerciseId === exerciseId)
      .sort((a, b) => a.position - b.position);
    const [first] = entries;
    if (!first) continue;

    const scored = entries.flatMap((entry) =>
      [...entry.sets].sort((a, b) => a.position - b.position).filter(isScoredSet),
    );

    let topSet: ScoredSet | null = null;
    let bestE1rmKg: number | null = null;
    for (const set of scored) {
      if (
        topSet === null ||
        set.weightKg > topSet.weightKg ||
        (set.weightKg === topSet.weightKg && set.reps > topSet.reps)
      ) {
        topSet = set;
      }
      const e1rm = estimateOneRepMaxKg(set.weightKg, set.reps);
      if (e1rm !== null && (bestE1rmKg === null || e1rm > bestE1rmKg)) bestE1rmKg = e1rm;
    }

    sessions.push({
      lyftaId: workout.lyftaId,
      performedAt: workout.performedAt,
      date: localDateKey(workout.performedAt),
      name: first.name,
      scoredSets: scored.length,
      volumeKg: scored.reduce((sum, set) => sum + set.weightKg * set.reps, 0),
      bestWeightKg: topSet === null ? null : topSet.weightKg,
      bestE1rmKg,
      topSet: topSet === null ? null : { weightKg: topSet.weightKg, reps: topSet.reps },
    });
  }

  return sessions;
}
