import { openEmptyTestDatabase, openTestDatabase } from '@/test-support/sqljsDatabase';
import { migrate } from './migrate';
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
    "INSERT INTO workout VALUES (1, '2026-08-20T17:05:00.000Z', 'A', NULL, '{}', '2026-11-12T00:00:00.000Z')",
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
  await migrate(db, MIGRATIONS.slice(0, 1));
  await db.run(
    "INSERT INTO workout VALUES (1, '2026-08-20T17:05:00.000Z', 'A', 500, 82, '{\"id\":1}', '2026-11-12T00:00:00.000Z')",
  );
  await db.run(
    "INSERT INTO workout_exercise VALUES (10, 1, 0, 2, 'Bench Press', 'weight_reps', 180)",
  );
  await db.run('INSERT INTO workout_set VALUES (100, 10, 0, 80, 5, 2, NULL, NULL, NULL, 1)');

  expect(await migrate(db, MIGRATIONS)).toBe(MIGRATIONS.length);

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
