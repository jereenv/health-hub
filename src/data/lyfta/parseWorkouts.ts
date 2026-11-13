import { z } from 'zod';

import type { Workout, WorkoutExercise, WorkoutSet, WeightUnit } from '@/domain/workouts/types';

import { LyftaError } from './LyftaError';
import { parseNumeric } from './parseNumeric';

/** Exact international pound, used to store every weight in kilograms. */
export const LB_TO_KG = 0.45359237;

export interface ParsedWorkout {
  workout: Workout;
  /** The workout exactly as Lyfta sent it, kept so we can re-parse after schema changes. */
  rawJson: string;
}

export interface ParsedWorkoutPage {
  workouts: ParsedWorkout[];
  /** Workouts dropped because they failed validation; one bad record must not block a sync. */
  skipped: number;
  currentPage: number;
  totalPages: number;
}

// Lyfta sends numbers as strings or numbers depending on the field, so accept either and
// normalise later with parseNumeric.
const looseNumber = z.union([z.string(), z.number()]).nullish();

const setSchema = z.object({
  weight: looseNumber,
  reps: looseNumber,
  rir: looseNumber,
  duration: looseNumber,
  distance: looseNumber,
  set_type_id: looseNumber,
  is_completed: z.boolean().nullish(),
});

const exerciseSchema = z.object({
  exercise_id: z.number(),
  // Lyfta really spells this field "excercise_name".
  excercise_name: z.string(),
  exercise_type: z.string(),
  exercise_rest_time: looseNumber,
  sets: z.array(setSchema).nullish(),
});

const workoutSchema = z.object({
  id: z.number(),
  title: z.string(),
  workout_perform_date: z
    .string()
    .refine((value) => !Number.isNaN(new Date(value).getTime()), 'invalid date'),
  total_volume: looseNumber,
  body_weight: looseNumber,
  exercises: z.array(exerciseSchema).nullish(),
});

const pageSchema = z.object({
  workouts: z.array(z.unknown()),
  current_page: z.number().default(1),
  total_pages: z.number().default(1),
});

function toKg(value: unknown, unit: WeightUnit): number | null {
  const parsed = parseNumeric(value);
  if (parsed === null) {
    return null;
  }
  return unit === 'lb' ? parsed * LB_TO_KG : parsed;
}

function toSetType(value: unknown): string | null {
  const parsed = parseNumeric(value);
  return parsed === null ? null : String(parsed);
}

function toSet(raw: z.infer<typeof setSchema>, position: number, unit: WeightUnit): WorkoutSet {
  const reps = parseNumeric(raw.reps);
  return {
    position,
    weightKg: toKg(raw.weight, unit),
    reps: reps === null ? null : Math.round(reps),
    rir: parseNumeric(raw.rir),
    duration: parseNumeric(raw.duration),
    distance: parseNumeric(raw.distance),
    setType: toSetType(raw.set_type_id),
    completed: raw.is_completed ?? false,
  };
}

function toExercise(
  raw: z.infer<typeof exerciseSchema>,
  position: number,
  unit: WeightUnit,
): WorkoutExercise {
  return {
    position,
    exerciseId: raw.exercise_id,
    name: raw.excercise_name,
    exerciseType: raw.exercise_type,
    restTimeS: parseNumeric(raw.exercise_rest_time),
    sets: (raw.sets ?? []).map((set, index) => toSet(set, index, unit)),
  };
}

function toWorkout(raw: z.infer<typeof workoutSchema>, unit: WeightUnit): Workout {
  return {
    lyftaId: raw.id,
    performedAt: new Date(raw.workout_perform_date).toISOString(),
    title: raw.title,
    totalVolumeKg: toKg(raw.total_volume, unit),
    exercises: (raw.exercises ?? []).map((exercise, index) => toExercise(exercise, index, unit)),
  };
}

/**
 * Validates one page of Lyfta's workouts response. The envelope must be well formed (otherwise
 * LyftaError 'invalid_response'), but individual bad workouts are skipped and counted.
 */
export function parseWorkoutPage(json: unknown, unit: WeightUnit): ParsedWorkoutPage {
  const envelope = pageSchema.safeParse(json);
  if (!envelope.success) {
    throw new LyftaError('invalid_response', 'Lyfta response has no workouts array');
  }

  const workouts: ParsedWorkout[] = [];
  let skipped = 0;
  for (const rawWorkout of envelope.data.workouts) {
    const result = workoutSchema.safeParse(rawWorkout);
    if (!result.success) {
      skipped += 1;
      continue;
    }
    workouts.push({ workout: toWorkout(result.data, unit), rawJson: JSON.stringify(rawWorkout) });
  }

  return {
    workouts,
    skipped,
    currentPage: envelope.data.current_page,
    totalPages: envelope.data.total_pages,
  };
}
