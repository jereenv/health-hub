import { estimateOneRepMaxKg, isScoredSet } from './metrics';
import type { Workout } from './types';

export type PrKind = 'weight' | 'e1rm';

export interface PersonalRecord {
  kind: PrKind;
  exerciseId: number;
  lyftaId: number;
  exercisePosition: number;
  setPosition: number;
  valueKg: number;
  previousKg: number;
}

/** Values closer than this are treated as equal. */
const EPSILON_KG = 1e-6;

/** Stable identity of one set within one workout: 'lyftaId:exercisePosition:setPosition'. */
export function prSetKey(lyftaId: number, exercisePosition: number, setPosition: number): string {
  return `${lyftaId}:${exercisePosition}:${setPosition}`;
}

interface Candidate {
  exercisePosition: number;
  setPosition: number;
  valueKg: number;
}

interface Bests {
  weight?: number;
  e1rm?: number;
}

/** Oldest first: by performedAt, then lyftaId. */
export function compareWorkouts(a: Workout, b: Workout): number {
  if (a.performedAt !== b.performedAt) return a.performedAt < b.performedAt ? -1 : 1;
  return a.lyftaId - b.lyftaId;
}

/**
 * Personal records across all workouts. Each workout's best set per exercise
 * (pooled across repeats of that exercise) is a PR when it beats the best of
 * every earlier workout; the first session of an exercise is only a baseline.
 */
export function computePersonalRecords(workouts: readonly Workout[]): PersonalRecord[] {
  const records: PersonalRecord[] = [];
  const bests = new Map<number, Bests>();

  for (const workout of [...workouts].sort(compareWorkouts)) {
    const bestWeight = new Map<number, Candidate>();
    const bestE1rm = new Map<number, Candidate>();

    const exercises = [...workout.exercises].sort((a, b) => a.position - b.position);
    for (const exercise of exercises) {
      const sets = [...exercise.sets].sort((a, b) => a.position - b.position);
      for (const set of sets) {
        if (!isScoredSet(set)) continue;
        const where = { exercisePosition: exercise.position, setPosition: set.position };

        const weightBest = bestWeight.get(exercise.exerciseId);
        if (weightBest === undefined || set.weightKg > weightBest.valueKg + EPSILON_KG) {
          bestWeight.set(exercise.exerciseId, { ...where, valueKg: set.weightKg });
        }

        const e1rm = estimateOneRepMaxKg(set.weightKg, set.reps);
        if (e1rm === null) continue;
        const e1rmBest = bestE1rm.get(exercise.exerciseId);
        if (e1rmBest === undefined || e1rm > e1rmBest.valueKg + EPSILON_KG) {
          bestE1rm.set(exercise.exerciseId, { ...where, valueKg: e1rm });
        }
      }
    }

    const emit = (kind: PrKind, candidates: Map<number, Candidate>): void => {
      for (const [exerciseId, candidate] of candidates) {
        const previous = bests.get(exerciseId)?.[kind];
        if (previous !== undefined && candidate.valueKg > previous + EPSILON_KG) {
          records.push({
            kind,
            exerciseId,
            lyftaId: workout.lyftaId,
            exercisePosition: candidate.exercisePosition,
            setPosition: candidate.setPosition,
            valueKg: candidate.valueKg,
            previousKg: previous,
          });
        }
      }
    };
    emit('weight', bestWeight);
    emit('e1rm', bestE1rm);

    for (const [kind, candidates] of [
      ['weight', bestWeight],
      ['e1rm', bestE1rm],
    ] as const) {
      for (const [exerciseId, candidate] of candidates) {
        const current = bests.get(exerciseId) ?? {};
        const existing = current[kind];
        if (existing === undefined || candidate.valueKg > existing) {
          current[kind] = candidate.valueKg;
        }
        bests.set(exerciseId, current);
      }
    }
  }

  return records;
}

/** The set of PR set keys; a set holding both kinds appears once. */
export function prSetKeys(records: readonly PersonalRecord[]): ReadonlySet<string> {
  return new Set(records.map((r) => prSetKey(r.lyftaId, r.exercisePosition, r.setPosition)));
}
