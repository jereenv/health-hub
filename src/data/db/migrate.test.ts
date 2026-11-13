import { openEmptyTestDatabase, openTestDatabase } from '@/test-support/sqljsDatabase';
import { DatabaseTooNewError, migrate } from './migrate';
import { MIGRATIONS } from './schema';

test('applies all migrations to a fresh database', async () => {
  const db = await openEmptyTestDatabase();
  expect(await migrate(db, MIGRATIONS)).toBe(MIGRATIONS.length);
  const tables = await db.all<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  );
  expect(tables.map((t) => t.name)).toEqual(
    expect.arrayContaining(['setting', 'sync_state', 'workout', 'workout_exercise', 'workout_set']),
  );
});

test('is a no-op when already at the latest version', async () => {
  const db = await openTestDatabase();
  expect(await migrate(db, MIGRATIONS)).toBe(MIGRATIONS.length);
});

test('rolls back a failing migration and keeps the previous version', async () => {
  const db = await openEmptyTestDatabase();
  await expect(migrate(db, [...MIGRATIONS, 'CREATE TABLE broken (;'])).rejects.toThrow();
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  expect(row?.user_version).toBe(MIGRATIONS.length);
});

test('deleting a workout cascades to its exercises and sets', async () => {
  const db = await openTestDatabase();
  await db.run(
    `INSERT INTO workout (lyfta_id, performed_at, title, raw_json, synced_at)
     VALUES (1, '2026-08-20T17:05:00.000Z', 'A', '{}', '2026-11-12T00:00:00.000Z')`,
  );
  await db.run(
    "INSERT INTO workout_exercise VALUES (10, 1, 0, 2, 'Bench Press', 'weight_reps', 180)",
  );
  await db.run('INSERT INTO workout_set VALUES (100, 10, 0, 80, 5, 2, NULL, NULL, NULL, 1)');
  await db.run('DELETE FROM workout WHERE lyfta_id = 1');
  expect(await db.first('SELECT * FROM workout_set')).toBeNull();
});

test('v2 drops the body weight column and keeps existing workouts, exercises and sets', async () => {
  const db = await openEmptyTestDatabase();
  const v2Migrations = MIGRATIONS.slice(0, 2);
  await migrate(db, MIGRATIONS.slice(0, 1));
  await db.run(
    `INSERT INTO workout (lyfta_id, performed_at, title, total_volume_kg, body_weight_kg, raw_json,
                          synced_at)
     VALUES (1, '2026-08-20T17:05:00.000Z', 'A', 500, 82, '{"id":1}', '2026-11-12T00:00:00.000Z')`,
  );
  await db.run(
    "INSERT INTO workout_exercise VALUES (10, 1, 0, 2, 'Bench Press', 'weight_reps', 180)",
  );
  await db.run('INSERT INTO workout_set VALUES (100, 10, 0, 80, 5, 2, NULL, NULL, NULL, 1)');

  expect(await migrate(db, v2Migrations)).toBe(2);

  const columns = await db.all<{ name: string }>('PRAGMA table_info(workout)');
  expect(columns.map((c) => c.name)).toEqual([
    'lyfta_id',
    'performed_at',
    'title',
    'total_volume_kg',
    'raw_json',
    'synced_at',
  ]);
  expect(await db.first('SELECT title, total_volume_kg, raw_json FROM workout')).toEqual({
    title: 'A',
    total_volume_kg: 500,
    raw_json: '{"id":1}',
  });
  expect((await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM workout_set'))?.n).toBe(1);
});

test('v3 adds workout.duration_s and drops total_volume_kg, keeping existing rows', async () => {
  const db = await openEmptyTestDatabase();
  await migrate(db, MIGRATIONS.slice(0, 2));
  await db.run(
    `INSERT INTO workout (lyfta_id, performed_at, title, total_volume_kg, raw_json, synced_at)
     VALUES (1, '2026-08-20T17:05:00.000Z', 'A', 500, '{"id":1,"total_volume":500}',
             '2026-11-12T00:00:00.000Z')`,
  );
  await db.run(
    "INSERT INTO workout_exercise VALUES (10, 1, 0, 2, 'Bench Press', 'weight_reps', 180)",
  );
  await db.run('INSERT INTO workout_set VALUES (100, 10, 0, 80, 5, 2, NULL, NULL, NULL, 1)');

  expect(await migrate(db, MIGRATIONS)).toBe(MIGRATIONS.length);
  expect(MIGRATIONS.length).toBeGreaterThanOrEqual(3);

  const columns = await db.all<{ name: string }>('PRAGMA table_info(workout)');
  expect(columns.map((c) => c.name)).toEqual([
    'lyfta_id',
    'performed_at',
    'title',
    'raw_json',
    'synced_at',
    'duration_s',
  ]);
  expect(await db.first('SELECT title, duration_s, raw_json FROM workout')).toEqual({
    title: 'A',
    duration_s: null,
    raw_json: '{"id":1,"total_volume":500}',
  });
  expect((await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM workout_exercise'))?.n).toBe(1);
  expect((await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM workout_set'))?.n).toBe(1);
});

test('v4 adds sync_state skipped and deletion pause columns, keeping existing rows', async () => {
  const db = await openEmptyTestDatabase();
  await migrate(db, MIGRATIONS.slice(0, 3));
  await db.run(
    `INSERT INTO sync_state (source, cursor, last_success_at, last_error, last_error_at)
     VALUES ('lyfta', 'c', '2026-11-12T10:00:00.000Z', 'boom', '2026-11-12T11:00:00.000Z')`,
  );

  expect(await migrate(db, MIGRATIONS)).toBe(MIGRATIONS.length);
  expect(MIGRATIONS.length).toBeGreaterThanOrEqual(4);

  const columns = await db.all<{ name: string; notnull: number; dflt_value: string | null }>(
    'PRAGMA table_info(sync_state)',
  );
  expect(columns.find((c) => c.name === 'last_skipped')).toMatchObject({
    notnull: 1,
    dflt_value: '0',
  });
  expect(columns.find((c) => c.name === 'deletion_pause')).toMatchObject({ notnull: 0 });
  expect(await db.first('SELECT * FROM sync_state')).toEqual({
    source: 'lyfta',
    cursor: 'c',
    last_success_at: '2026-11-12T10:00:00.000Z',
    last_error: 'boom',
    last_error_at: '2026-11-12T11:00:00.000Z',
    last_skipped: 0,
    deletion_pause: null,
  });
});

test('v5 adds the scheduled_workout table and date index, keeping existing rows', async () => {
  const db = await openEmptyTestDatabase();
  await migrate(db, MIGRATIONS.slice(0, 4));
  await db.run(
    `INSERT INTO sync_state (source, cursor, last_success_at) VALUES ('lyfta', 'c', '2026-11-12T10:00:00.000Z')`,
  );

  expect(await migrate(db, MIGRATIONS)).toBe(MIGRATIONS.length);
  expect(MIGRATIONS.length).toBeGreaterThanOrEqual(5);

  const columns = await db.all<{ name: string; notnull: number; pk: number }>(
    'PRAGMA table_info(scheduled_workout)',
  );
  expect(columns.map((c) => c.name)).toEqual([
    'lyfta_id',
    'scheduled_date',
    'title',
    'template_id',
    'source',
    'status',
    'completed',
    'raw_json',
    'synced_at',
  ]);
  expect(columns.find((c) => c.name === 'lyfta_id')).toMatchObject({ pk: 1, notnull: 1 });
  expect(columns.find((c) => c.name === 'template_id')).toMatchObject({ notnull: 0 });
  const indexes = await db.all<{ name: string }>('PRAGMA index_list(scheduled_workout)');
  expect(indexes.map((i) => i.name)).toContain('idx_scheduled_workout_date');
  expect(
    await db.first<{ cursor: string }>("SELECT cursor FROM sync_state WHERE source = 'lyfta'"),
  ).toEqual({
    cursor: 'c',
  });
});

test('v6 adds the profile_version table and index, keeping existing rows', async () => {
  const db = await openEmptyTestDatabase();
  await migrate(db, MIGRATIONS.slice(0, 5));
  await db.run(
    `INSERT INTO scheduled_workout VALUES ('s1', '2026-11-13', 'Push', NULL, NULL, NULL, 0, '{}',
     '2026-11-12T10:00:00.000Z')`,
  );
  await db.run("INSERT INTO setting (key, value) VALUES ('lyfta.weightUnit', 'kg')");

  expect(await migrate(db, MIGRATIONS)).toBe(MIGRATIONS.length);
  expect(MIGRATIONS.length).toBeGreaterThanOrEqual(6);

  const columns = await db.all<{ name: string; notnull: number; pk: number }>(
    'PRAGMA table_info(profile_version)',
  );
  expect(columns.map((c) => c.name)).toEqual([
    'id',
    'effective_from',
    'height_cm',
    'birth_date',
    'sex',
    'goal_weight_kg',
    'bmi_cutoffs',
  ]);
  expect(columns.find((c) => c.name === 'id')).toMatchObject({ pk: 1 });
  expect(columns.find((c) => c.name === 'effective_from')).toMatchObject({ notnull: 1 });
  expect(columns.find((c) => c.name === 'bmi_cutoffs')).toMatchObject({ notnull: 1 });
  expect(columns.find((c) => c.name === 'height_cm')).toMatchObject({ notnull: 0 });
  const indexes = await db.all<{ name: string }>('PRAGMA index_list(profile_version)');
  expect(indexes.map((i) => i.name)).toContain('idx_profile_version_effective');
  expect(await db.first('SELECT title FROM scheduled_workout WHERE lyfta_id = ?', ['s1'])).toEqual({
    title: 'Push',
  });
  expect(await db.first("SELECT value FROM setting WHERE key = 'lyfta.weightUnit'")).toEqual({
    value: 'kg',
  });
});

test('refuses a database newer than the app', async () => {
  const db = await openTestDatabase();
  await db.exec(`PRAGMA user_version = ${MIGRATIONS.length + 1}`);
  await expect(migrate(db, MIGRATIONS)).rejects.toBeInstanceOf(DatabaseTooNewError);
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  expect(row?.user_version).toBe(MIGRATIONS.length + 1);
});

async function seedWorkoutWithChildren(db: Awaited<ReturnType<typeof openTestDatabase>>) {
  await db.run(
    `INSERT INTO workout (lyfta_id, performed_at, title, raw_json, synced_at)
     VALUES (1, '2026-08-20T17:05:00.000Z', 'A', '{}', '2026-11-12T00:00:00.000Z')`,
  );
  await db.run(
    "INSERT INTO workout_exercise VALUES (10, 1, 0, 2, 'Bench Press', 'weight_reps', 180)",
  );
  await db.run('INSERT INTO workout_set VALUES (100, 10, 0, 80, 5, 2, NULL, NULL, NULL, 1)');
}

async function foreignKeysEnabled(db: Awaited<ReturnType<typeof openTestDatabase>>) {
  const row = await db.first<{ foreign_keys: number }>('PRAGMA foreign_keys');
  return row?.foreign_keys;
}

test('a foreign-keys-off step can rebuild a parent table', async () => {
  const db = await openTestDatabase();
  await seedWorkoutWithChildren(db);
  const rebuild = {
    foreignKeysOff: true as const,
    sql: `
      CREATE TABLE workout_new (
        lyfta_id INTEGER PRIMARY KEY NOT NULL, performed_at TEXT NOT NULL, title TEXT NOT NULL,
        raw_json TEXT NOT NULL, synced_at TEXT NOT NULL, duration_s INTEGER);
      INSERT INTO workout_new (lyfta_id, performed_at, title, raw_json, synced_at, duration_s)
        SELECT lyfta_id, performed_at, title, raw_json, synced_at, duration_s FROM workout;
      DROP TABLE workout;
      ALTER TABLE workout_new RENAME TO workout;`,
  };
  expect(await migrate(db, [...MIGRATIONS, rebuild])).toBe(MIGRATIONS.length + 1);
  expect((await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM workout'))?.n).toBe(1);
  expect((await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM workout_exercise'))?.n).toBe(1);
  expect((await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM workout_set'))?.n).toBe(1);
  expect(await foreignKeysEnabled(db)).toBe(1);
});

test('a foreign-keys-off step that orphans rows rolls back', async () => {
  const db = await openTestDatabase();
  await seedWorkoutWithChildren(db);
  const orphan = { foreignKeysOff: true as const, sql: 'DELETE FROM workout;' };
  await expect(migrate(db, [...MIGRATIONS, orphan])).rejects.toThrow(/foreign key violations/);
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  expect(row?.user_version).toBe(MIGRATIONS.length);
  expect((await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM workout'))?.n).toBe(1);
  expect(await foreignKeysEnabled(db)).toBe(1);
});
