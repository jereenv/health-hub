import type { Workout, WorkoutExercise, WorkoutSet } from './types';

/** Epley is only trusted up to this many reps; heavier-rep sets get no estimate. */
export const EPLEY_MAX_REPS = 12;

/** A completed set with a positive weight and at least one rep. */
export type ScoredSet = WorkoutSet & { weightKg: number; reps: number };

/**
 * Whether a set counts toward volume and records. Set types are deliberately
 * not consulted: every type counts until their meanings are known.
 */
export function isScoredSet(set: WorkoutSet): set is ScoredSet {
  return (
    set.completed && set.weightKg !== null && set.weightKg > 0 && set.reps !== null && set.reps >= 1
  );
}

/** Weight x reps for a scored set, otherwise 0. */
export function setVolumeKg(set: WorkoutSet): number {
  return isScoredSet(set) ? set.weightKg * set.reps : 0;
}

export function exerciseVolumeKg(exercise: WorkoutExercise): number {
  return exercise.sets.reduce((sum, set) => sum + setVolumeKg(set), 0);
}

/** The one volume definition used everywhere; Lyfta's own total is never used. */
export function workoutVolumeKg(workout: Workout): number {
  return workout.exercises.reduce((sum, exercise) => sum + exerciseVolumeKg(exercise), 0);
}

export function scoredSetCount(exercise: WorkoutExercise): number {
  return exercise.sets.filter(isScoredSet).length;
}

/** Epley estimate: weight x (1 + reps / 30). Null outside 1..EPLEY_MAX_REPS reps. */
export function estimateOneRepMaxKg(weightKg: number, reps: number): number | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) return null;
  if (reps < 1 || reps > EPLEY_MAX_REPS) return null;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}
