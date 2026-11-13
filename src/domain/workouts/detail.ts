import { localDateKey, type DateKey } from '@/domain/time/localDate';

import { exerciseVolumeKg, scoredSetCount, workoutVolumeKg } from './metrics';
import { prSetKey } from './records';
import type { Workout, WorkoutSet } from './types';

export interface WorkoutDetail {
  lyftaId: number;
  title: string;
  date: DateKey;
  durationS: number | null;
  volumeKg: number;
  exerciseCount: number;
  /** Every set, done or not. */
  setCount: number;
  prCount: number;
  exercises: {
    exerciseId: number;
    position: number;
    name: string;
    scoredSets: number;
    volumeKg: number;
    sets: { set: WorkoutSet; isPr: boolean }[];
  }[];
}

export function buildWorkoutDetail(workout: Workout, prKeys: ReadonlySet<string>): WorkoutDetail {
  const exercises = workout.exercises.map((exercise) => ({
    exerciseId: exercise.exerciseId,
    position: exercise.position,
    name: exercise.name,
    scoredSets: scoredSetCount(exercise),
    volumeKg: exerciseVolumeKg(exercise),
    sets: exercise.sets.map((set) => ({
      set,
      isPr: prKeys.has(prSetKey(workout.lyftaId, exercise.position, set.position)),
    })),
  }));
  return {
    lyftaId: workout.lyftaId,
    title: workout.title,
    date: localDateKey(workout.performedAt),
    durationS: workout.durationS,
    volumeKg: workoutVolumeKg(workout),
    exerciseCount: exercises.length,
    setCount: exercises.reduce((sum, e) => sum + e.sets.length, 0),
    prCount: exercises.reduce((sum, e) => sum + e.sets.filter((s) => s.isPr).length, 0),
    exercises,
  };
}
