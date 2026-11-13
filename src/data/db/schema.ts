import type { Migration } from './migrate';

export const DATABASE_NAME = 'health-hub.db';

/**
 * Ordered migration steps. Index + 1 is the schema version the step upgrades
 * *to*. Never edit a shipped step; always append a new one.
 */
export const MIGRATIONS: readonly Migration[] = [
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
  // v3 — stores Lyfta's workout duration. Volume is always computed from completed sets, so the
  // unused total_volume_kg is dropped; the original value remains in workout.raw_json. Neither
  // statement rebuilds the table, so foreign keys need not be switched off.
  `
  ALTER TABLE workout ADD COLUMN duration_s INTEGER;
  ALTER TABLE workout DROP COLUMN total_volume_kg;
  `,
  // v4 — persists sync health for the UI: how many workouts the last run could not read, and why
  // deletions are paused (JSON DeletionPause, null when they are not).
  `
  ALTER TABLE sync_state ADD COLUMN last_skipped INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE sync_state ADD COLUMN deletion_pause TEXT;
  `,
  // v5 — the owner's Lyfta schedule: planned and recently completed workouts around today.
  // scheduled_date is a calendar day (YYYY-MM-DD) in the phone's zone, not a timestamp.
  `
  CREATE TABLE scheduled_workout (
    lyfta_id TEXT PRIMARY KEY NOT NULL, scheduled_date TEXT NOT NULL, title TEXT NOT NULL,
    template_id TEXT, source TEXT, status TEXT, completed INTEGER NOT NULL,
    raw_json TEXT NOT NULL, synced_at TEXT NOT NULL);
  CREATE INDEX idx_scheduled_workout_date ON scheduled_workout (scheduled_date);
  `,
  // v6 — the owner's body profile, append-only so an old weigh-in uses the profile in effect then.
  // effective_from is an ISO-8601 UTC instant; birth_date is a calendar day (YYYY-MM-DD).
  `
  CREATE TABLE profile_version (
    id INTEGER PRIMARY KEY AUTOINCREMENT, effective_from TEXT NOT NULL,
    height_cm REAL, birth_date TEXT, sex TEXT, goal_weight_kg REAL, bmi_cutoffs TEXT NOT NULL);
  CREATE INDEX idx_profile_version_effective ON profile_version (effective_from);
  `,
  // v7 — Health Connect imports. Daily and session tables are replaced over a trailing window on
  // every sync; watch_body_fat and the health_connect rows of scale_reading are rebuilt in full.
  // scale_reading and legacy_body_value also take BLE readings in a later plan, so they keep their
  // own keys. Dates are calendar days (YYYY-MM-DD) in the phone's zone; instants are ISO UTC.
  `
  CREATE TABLE activity_daily (
    date TEXT PRIMARY KEY NOT NULL, steps INTEGER, distance_m REAL, active_kcal REAL,
    total_kcal REAL, synced_at TEXT NOT NULL);
  CREATE TABLE sleep_session (
    hc_id TEXT PRIMARY KEY NOT NULL, start_at TEXT NOT NULL, end_at TEXT NOT NULL,
    wake_date TEXT NOT NULL, asleep_s INTEGER NOT NULL, awake_s INTEGER NOT NULL,
    light_s INTEGER, deep_s INTEGER, rem_s INTEGER, has_stages INTEGER NOT NULL,
    synced_at TEXT NOT NULL);
  CREATE INDEX idx_sleep_session_wake_date ON sleep_session (wake_date);
  CREATE TABLE heart_rate_daily (
    date TEXT PRIMARY KEY NOT NULL, min_bpm INTEGER NOT NULL, avg_bpm REAL NOT NULL,
    max_bpm INTEGER NOT NULL, synced_at TEXT NOT NULL);
  CREATE TABLE watch_body_fat (
    hc_id TEXT PRIMARY KEY NOT NULL, measured_at TEXT NOT NULL, body_fat_pct REAL NOT NULL,
    origin TEXT NOT NULL);
  CREATE INDEX idx_watch_body_fat_measured_at ON watch_body_fat (measured_at);
  CREATE TABLE scale_reading (
    id INTEGER PRIMARY KEY AUTOINCREMENT, measured_at TEXT NOT NULL, weight_kg REAL NOT NULL,
    impedance_ohm REAL, source TEXT NOT NULL, source_record_id TEXT NOT NULL, raw_payload TEXT,
    device_id TEXT, UNIQUE (source, source_record_id));
  CREATE INDEX idx_scale_reading_measured_at ON scale_reading (measured_at);
  CREATE TABLE legacy_body_value (
    reading_id INTEGER NOT NULL REFERENCES scale_reading (id) ON DELETE CASCADE,
    metric TEXT NOT NULL, value REAL NOT NULL, origin TEXT NOT NULL,
    PRIMARY KEY (reading_id, metric));
  `,
];
