export const DATABASE_NAME = 'health-hub.db';

/**
 * Ordered migration steps. Index + 1 is the schema version the step upgrades
 * *to*. Never edit a shipped step; always append a new one.
 */
export const MIGRATIONS: readonly string[] = [
  // v1 — initial schema. Column order matters: tests insert positionally.
  // `duration` and `distance` keep Lyfta's own units until they are confirmed.
  `
  CREATE TABLE workout (
    lyfta_id INTEGER PRIMARY KEY NOT NULL, performed_at TEXT NOT NULL, title TEXT NOT NULL,
    total_volume_kg REAL, body_weight_kg REAL, raw_json TEXT NOT NULL, synced_at TEXT NOT NULL);
  CREATE INDEX idx_workout_performed_at ON workout (performed_at);
  CREATE TABLE workout_exercise (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id INTEGER NOT NULL REFERENCES workout (lyfta_id) ON DELETE CASCADE,
    position INTEGER NOT NULL, exercise_id INTEGER NOT NULL, name TEXT NOT NULL,
    exercise_type TEXT NOT NULL, rest_time_s INTEGER);
  CREATE INDEX idx_workout_exercise_workout ON workout_exercise (workout_id);
  CREATE INDEX idx_workout_exercise_exercise ON workout_exercise (exercise_id);
  CREATE TABLE workout_set (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercise (id) ON DELETE CASCADE,
    position INTEGER NOT NULL, weight_kg REAL, reps INTEGER, rir REAL,
    duration REAL, distance REAL, set_type TEXT, completed INTEGER NOT NULL);
  CREATE TABLE sync_state (
    source TEXT PRIMARY KEY NOT NULL, cursor TEXT, last_success_at TEXT,
    last_error TEXT, last_error_at TEXT);
  CREATE TABLE setting (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  `,
  // v2 — Lyfta's workout body weight is hand-entered and never used; body weight comes from the
  // scale and Health Connect. The original value remains in workout.raw_json.
  'ALTER TABLE workout DROP COLUMN body_weight_kg;',
];
