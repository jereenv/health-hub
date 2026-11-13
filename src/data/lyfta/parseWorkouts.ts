import { z } from 'zod';

import type { Workout, WorkoutExercise, WorkoutSet, WeightUnit } from '@/domain/workouts/types';

import { LB_TO_KG } from '@/domain/format/units';

import { LyftaError } from './LyftaError';
import { parseDurationSeconds } from './parseDuration';
import { parseLyftaInstant } from './parseLyftaDates';
import { parseNumeric } from './parseNumeric';
import { parseWeightUnit } from './lyftaUnit';

/** Re-exported: the constant lives in the domain layer, which must not import from data. */
export { LB_TO_KG };

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
  /** The envelope's `total_records` (number or numeric string); null when absent. */
  totalRecords: number | null;
}

/** Bump when parsing changes in a way that makes stored `raw_json` worth re-parsing. */
export const WORKOUT_PARSER_VERSION = 2;

// Every field is optional and loosely typed: a malformed field we ignore (or can default) must
// never cause a whole workout to be skipped. Each value is validated by hand below.
const setSchema = z.object({
  weight: z.unknown().optional(),
  reps: z.unknown().optional(),
  rir: z.unknown().optional(),
  duration: z.unknown().optional(),
  distance: z.unknown().optional(),
  set_type_id: z.unknown().optional(),
  is_completed: z.unknown().optional(),
});

const exerciseSchema = z.object({
  exercise_id: z.unknown().optional(),
  // Lyfta really spells this field "excercise_name".
  excercise_name: z.unknown().optional(),
  exercise_type: z.unknown().optional(),
  exercise_rest_time: z.unknown().optional(),
  sets: z.unknown().optional(),
});

const workoutSchema = z.object({
  id: z.unknown().optional(),
  title: z.unknown().optional(),
  workout_perform_date: z.unknown().optional(),
  workout_duration: z.unknown().optional(),
  weight_unit: z.unknown().optional(),
  exercises: z.unknown().optional(),
});

const pageSchema = z.object({
  workouts: z.array(z.unknown()),
  current_page: z.number().default(1),
  total_pages: z.number().default(1),
  total_records: z.unknown().optional(),
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

/** An integer id as a number or numeric string; null otherwise. */
function toId(value: unknown): number | null {
  const parsed = parseNumeric(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function toText(value: unknown, placeholder: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value : placeholder;
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
    completed: raw.is_completed === true,
  };
}

function toExercise(
  raw: z.infer<typeof exerciseSchema>,
  exerciseId: number,
  position: number,
  unit: WeightUnit,
): WorkoutExercise {
  const rawSets: unknown[] = Array.isArray(raw.sets) ? raw.sets : [];
  const sets: WorkoutSet[] = [];
  for (const entry of rawSets) {
    const parsed = setSchema.safeParse(entry);
    if (parsed.success) sets.push(toSet(parsed.data, sets.length, unit));
  }
  return {
    position,
    exerciseId,
    name: toText(raw.excercise_name, 'Exercise'),
    exerciseType: toText(raw.exercise_type, 'unknown'),
    restTimeS: parseNumeric(raw.exercise_rest_time),
    sets,
  };
}

/**
 * Parses one Lyfta workout object. Only the id and a valid perform date are required; returns
 * null when either is missing or unusable. Set weights use the workout's own `weight_unit` when it
 * has a recognised one, otherwise `unit`. Lyfta's `total_volume` and `body_weight` are never read
 * (volume is computed from sets); `rawJson` keeps them.
 */
export function parseWorkoutRecord(raw: unknown, unit: WeightUnit): ParsedWorkout | null {
  const result = workoutSchema.safeParse(raw);
  if (!result.success) return null;
  const record = result.data;

  const lyftaId = toId(record.id);
  const performedAt = parseLyftaInstant(record.workout_perform_date);
  if (lyftaId === null || performedAt === null) return null;

  const setUnit = parseWeightUnit(record.weight_unit) ?? unit;
  const rawExercises: unknown[] = Array.isArray(record.exercises) ? record.exercises : [];
  const exercises: WorkoutExercise[] = [];
  for (const entry of rawExercises) {
    const parsed = exerciseSchema.safeParse(entry);
    if (!parsed.success) continue;
    const exerciseId = toId(parsed.data.exercise_id);
    if (exerciseId === null) continue;
    exercises.push(toExercise(parsed.data, exerciseId, exercises.length, setUnit));
  }

  return {
    workout: {
      lyftaId,
      performedAt,
      title: toText(record.title, 'Workout'),
      durationS: parseDurationSeconds(record.workout_duration),
      exercises,
    },
    rawJson: JSON.stringify(raw),
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
    const parsed = parseWorkoutRecord(rawWorkout, unit);
    if (parsed === null) {
      skipped += 1;
      continue;
    }
    workouts.push(parsed);
  }

  return {
    workouts,
    skipped,
    currentPage: envelope.data.current_page,
    totalPages: envelope.data.total_pages,
    totalRecords: parseNumeric(envelope.data.total_records),
  };
}
