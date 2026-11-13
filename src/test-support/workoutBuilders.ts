import type { Workout, WorkoutExercise, WorkoutSet } from '@/domain/workouts/types';

/** A completed 80 kg x 5 set with no RIR unless overridden. */
export function makeSet(p: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    position: 0,
    weightKg: 80,
    reps: 5,
    rir: null,
    duration: null,
    distance: null,
    setType: null,
    completed: true,
    ...p,
  };
}

/** An exercise (default exerciseId 1, "Bench Press") with no sets unless overridden. */
export function makeExercise(p: Partial<WorkoutExercise> = {}): WorkoutExercise {
  return {
    position: 0,
    exerciseId: 1,
    name: 'Bench Press',
    exerciseType: 'weight_reps',
    restTimeS: null,
    sets: [],
    ...p,
  };
}

/** A workout with no exercises unless overridden. */
export function makeWorkout(
  p: Partial<Workout> & { lyftaId: number; performedAt: string },
): Workout {
  return {
    title: 'Workout',
    totalVolumeKg: null,
    exercises: [],
    ...p,
  };
}
