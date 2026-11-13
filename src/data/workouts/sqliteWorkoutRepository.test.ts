import { parseWorkoutPage } from '@/data/lyfta/parseWorkouts';
import { openTestDatabase } from '@/test-support/sqljsDatabase';

import { createSqliteWorkoutRepository } from './sqliteWorkoutRepository';

const sandbox = require('@/data/lyfta/__fixtures__/sandbox-workouts.json');

const SYNCED_AT = '2026-11-12T10:00:00.000Z';

async function setup() {
  const db = await openTestDatabase();
  const repo = createSqliteWorkoutRepository(db);
  const parsed = parseWorkoutPage(sandbox, 'kg').workouts;
  return { db, repo, parsed };
}

test('inserts workouts with exercises and sets', async () => {
  const { repo, parsed } = await setup();
  expect(await repo.upsertMany(parsed, SYNCED_AT)).toEqual({ inserted: 2, updated: 0 });
  expect(await repo.count()).toBe(2);
  expect(await repo.get(1001)).toEqual(parsed[0].workout);
  expect(await repo.get(1002)).toEqual(parsed[1].workout);
  expect(await repo.get(9999)).toBeNull();
});

test('upsert replaces exercises and sets', async () => {
  const { repo, parsed } = await setup();
  await repo.upsertMany(parsed, SYNCED_AT);

  const edited = structuredClone(parsed);
  edited[0].workout.exercises[0].sets[0].weightKg = 85;
  expect(await repo.upsertMany([edited[0]], SYNCED_AT)).toEqual({ inserted: 0, updated: 1 });

  const stored = await repo.get(1001);
  expect(stored?.exercises[0].sets[0].weightKg).toBe(85);
  expect(stored?.exercises[0].sets).toHaveLength(2);
  expect(await repo.count()).toBe(2);
});

test('lists newest first and pages with beforePerformedAt', async () => {
  const { repo, parsed } = await setup();
  await repo.upsertMany(parsed, SYNCED_AT);

  const first = await repo.list({ limit: 1 });
  expect(first.map((w) => w.lyftaId)).toEqual([1002]);
  expect(first[0]).toEqual(parsed[1].workout);

  const next = await repo.list({ limit: 1, beforePerformedAt: '2026-08-22T16:30:00.000Z' });
  expect(next.map((w) => w.lyftaId)).toEqual([1001]);
  expect(next[0]).toEqual(parsed[0].workout);
});

test('deleteMissingInRange removes only absent workouts inside the range', async () => {
  const { repo, parsed } = await setup();
  await repo.upsertMany(parsed, SYNCED_AT);

  const removed = await repo.deleteMissingInRange(
    '2026-08-21T00:00:00.000Z',
    '2026-08-23T23:59:59.999Z',
    [],
  );
  expect(removed).toBe(1);
  expect(await repo.get(1002)).toBeNull();
  expect(await repo.get(1001)).not.toBeNull();
});

test('deleteMissingInRange keeps listed ids and cascades to children', async () => {
  const { db, repo, parsed } = await setup();
  await repo.upsertMany(parsed, SYNCED_AT);

  const removed = await repo.deleteMissingInRange(
    '2026-08-01T00:00:00.000Z',
    '2026-08-31T00:00:00.000Z',
    [1002],
  );
  expect(removed).toBe(1);
  expect(await repo.count()).toBe(1);
  const orphans = await db.first<{ n: number }>(
    'SELECT COUNT(*) AS n FROM workout_exercise WHERE workout_id = 1001',
  );
  expect(orphans?.n).toBe(0);
});
