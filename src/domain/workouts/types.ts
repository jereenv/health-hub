/** Unit the Lyfta account reports weights in; everything we store is converted to kilograms. */
export type WeightUnit = 'kg' | 'lb';

/** One set of an exercise. Numeric fields are null when Lyfta sent an empty or invalid value. */
export interface WorkoutSet {
  position: number;
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
  duration: number | null;
  distance: number | null;
  setType: string | null;
  completed: boolean;
}

/** An exercise performed within a workout, with its sets in performed order. */
export interface WorkoutExercise {
  position: number;
  exerciseId: number;
  name: string;
  exerciseType: string;
  restTimeS: number | null;
  sets: WorkoutSet[];
}

/** A completed workout in app terms: ISO-8601 UTC timestamp, weights in kilograms. */
export interface Workout {
  lyftaId: number;
  performedAt: string;
  title: string;
  totalVolumeKg: number | null;
  exercises: WorkoutExercise[];
}
