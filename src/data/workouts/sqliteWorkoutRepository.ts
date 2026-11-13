import type { SqlDatabase, SqlValue } from '@/data/db/SqlDatabase';
import type { Workout, WorkoutExercise, WorkoutSet } from '@/domain/workouts/types';

import type { WorkoutRepository } from './WorkoutRepository';

interface WorkoutRow {
  lyfta_id: number;
  performed_at: string;
  title: string;
  total_volume_kg: number | null;
  body_weight_kg: number | null;
}

interface ExerciseRow {
  id: number;
  workout_id: number;
  position: number;
  exercise_id: number;
  name: string;
  exercise_type: string;
  rest_time_s: number | null;
}

interface SetRow {
  workout_exercise_id: number;
  position: number;
  weight_kg: number | null;
  reps: number | null;
  rir: number | null;
  duration: number | null;
  distance: number | null;
  set_type: string | null;
  completed: number;
}

/** Stays well under SQLite's bound-variable limit (999 on older builds). */
const CHUNK_SIZE = 500;

function chunk<T>(items: readonly T[]): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    chunks.push(items.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
}

function placeholders(count: number): string {
  return Array<string>(count).fill('?').join(', ');
}

/**
 * Loads exercises and sets for the given workout rows in two queries (not one per workout)
 * and assembles them into `Workout` objects, preserving the order of `rows`.
 */
async function hydrate(db: SqlDatabase, rows: readonly WorkoutRow[]): Promise<Workout[]> {
  const exercisesByWorkout = new Map<number, WorkoutExercise[]>();
  const setsByExercise = new Map<number, WorkoutSet[]>();

  for (const ids of chunk(rows.map((r) => r.lyfta_id))) {
    const exerciseRows = await db.all<ExerciseRow>(
      `SELECT id, workout_id, position, exercise_id, name, exercise_type, rest_time_s
       FROM workout_exercise WHERE workout_id IN (${placeholders(ids.length)})
       ORDER BY workout_id, position ASC`,
      ids,
    );
    for (const e of exerciseRows) {
      const sets: WorkoutSet[] = [];
      setsByExercise.set(e.id, sets);
      const exercise: WorkoutExercise = {
        position: e.position,
        exerciseId: e.exercise_id,
        name: e.name,
        exerciseType: e.exercise_type,
        restTimeS: e.rest_time_s,
        sets,
      };
      const list = exercisesByWorkout.get(e.workout_id);
      if (list) list.push(exercise);
      else exercisesByWorkout.set(e.workout_id, [exercise]);
    }

    const exerciseIds = exerciseRows.map((e) => e.id);
    for (const idChunk of chunk(exerciseIds)) {
      const setRows = await db.all<SetRow>(
        `SELECT workout_exercise_id, position, weight_kg, reps, rir, duration, distance,
                set_type, completed
         FROM workout_set WHERE workout_exercise_id IN (${placeholders(idChunk.length)})
         ORDER BY workout_exercise_id, position ASC`,
        idChunk,
      );
      for (const s of setRows) {
        setsByExercise.get(s.workout_exercise_id)?.push({
          position: s.position,
          weightKg: s.weight_kg,
          reps: s.reps,
          rir: s.rir,
          duration: s.duration,
          distance: s.distance,
          setType: s.set_type,
          completed: s.completed === 1,
        });
      }
    }
  }

  return rows.map((r) => ({
    lyftaId: r.lyfta_id,
    performedAt: r.performed_at,
    title: r.title,
    totalVolumeKg: r.total_volume_kg,
    bodyWeightKg: r.body_weight_kg,
    exercises: exercisesByWorkout.get(r.lyfta_id) ?? [],
  }));
}

const WORKOUT_COLUMNS = 'lyfta_id, performed_at, title, total_volume_kg, body_weight_kg';

/** SQLite-backed `WorkoutRepository`; runs unchanged on the phone and in Node tests. */
export function createSqliteWorkoutRepository(db: SqlDatabase): WorkoutRepository {
  return {
    async upsertMany(items, syncedAt) {
      // One transaction, and no call to another transaction-opening method inside it
      // (transactions are not re-entrant).
      return db.transaction(async () => {
        let inserted = 0;
        let updated = 0;
        for (const { workout, rawJson } of items) {
          const existing = await db.first<{ lyfta_id: number }>(
            'SELECT lyfta_id FROM workout WHERE lyfta_id = ?',
            [workout.lyftaId],
          );
          if (existing) updated += 1;
          else inserted += 1;

          await db.run(
            `INSERT INTO workout
               (lyfta_id, performed_at, title, total_volume_kg, body_weight_kg, raw_json, synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(lyfta_id) DO UPDATE SET
               performed_at = excluded.performed_at,
               title = excluded.title,
               total_volume_kg = excluded.total_volume_kg,
               body_weight_kg = excluded.body_weight_kg,
               raw_json = excluded.raw_json,
               synced_at = excluded.synced_at`,
            [
              workout.lyftaId,
              workout.performedAt,
              workout.title,
              workout.totalVolumeKg,
              workout.bodyWeightKg,
              rawJson,
              syncedAt,
            ],
          );

          // Children are replaced wholesale; sets cascade from their exercises.
          await db.run('DELETE FROM workout_exercise WHERE workout_id = ?', [workout.lyftaId]);
          for (const exercise of workout.exercises) {
            const { lastInsertRowId } = await db.run(
              `INSERT INTO workout_exercise
                 (workout_id, position, exercise_id, name, exercise_type, rest_time_s)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                workout.lyftaId,
                exercise.position,
                exercise.exerciseId,
                exercise.name,
                exercise.exerciseType,
                exercise.restTimeS,
              ],
            );
            for (const set of exercise.sets) {
              await db.run(
                `INSERT INTO workout_set
                   (workout_exercise_id, position, weight_kg, reps, rir, duration, distance,
                    set_type, completed)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  lastInsertRowId,
                  set.position,
                  set.weightKg,
                  set.reps,
                  set.rir,
                  set.duration,
                  set.distance,
                  set.setType,
                  set.completed ? 1 : 0,
                ],
              );
            }
          }
        }
        return { inserted, updated };
      });
    },

    async deleteMissingInRange(fromIso, toIso, keepIds) {
      return db.transaction(async () => {
        const keep = new Set(keepIds);
        const inRange = await db.all<{ lyfta_id: number }>(
          'SELECT lyfta_id FROM workout WHERE performed_at >= ? AND performed_at <= ?',
          [fromIso, toIso],
        );
        // Filtering in JS avoids `NOT IN ()` for an empty list and the bound-variable limit
        // for a long one.
        const doomed = inRange.map((r) => r.lyfta_id).filter((id) => !keep.has(id));
        let deleted = 0;
        for (const ids of chunk(doomed)) {
          const result = await db.run(
            `DELETE FROM workout WHERE lyfta_id IN (${placeholders(ids.length)})`,
            ids,
          );
          deleted += result.changes;
        }
        return deleted;
      });
    },

    async listIdsInRange(fromIso, toIso) {
      const rows = await db.all<{ lyfta_id: number }>(
        'SELECT lyfta_id FROM workout WHERE performed_at >= ? AND performed_at <= ?',
        [fromIso, toIso],
      );
      return rows.map((r) => r.lyfta_id);
    },

    async count() {
      const row = await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM workout');
      return row?.n ?? 0;
    },

    async list({ limit, beforePerformedAt }) {
      const params: SqlValue[] = [];
      let where = '';
      if (beforePerformedAt !== undefined) {
        where = 'WHERE performed_at < ?';
        params.push(beforePerformedAt);
      }
      params.push(limit);
      const rows = await db.all<WorkoutRow>(
        `SELECT ${WORKOUT_COLUMNS} FROM workout ${where}
         ORDER BY performed_at DESC, lyfta_id DESC LIMIT ?`,
        params,
      );
      return hydrate(db, rows);
    },

    async get(lyftaId) {
      const row = await db.first<WorkoutRow>(
        `SELECT ${WORKOUT_COLUMNS} FROM workout WHERE lyfta_id = ?`,
        [lyftaId],
      );
      if (!row) return null;
      const [workout] = await hydrate(db, [row]);
      return workout;
    },
  };
}
