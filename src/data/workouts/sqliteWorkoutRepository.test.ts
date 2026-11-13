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

test('stores and reads durationS', async () => {
  const { repo, parsed } = await setup();
  const withDuration = structuredClone(parsed);
  withDuration[0].workout.durationS = 7609;
  await repo.upsertMany(withDuration, SYNCED_AT);
  expect((await repo.get(1001))?.durationS).toBe(7609);
  expect((await repo.get(1002))?.durationS).toBeNull();

  withDuration[0].workout.durationS = null;
  await repo.upsertMany([withDuration[0]], SYNCED_AT);
  expect((await repo.get(1001))?.durationS).toBeNull();
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

test('listIdsInRange returns ids performed inside the inclusive range', async () => {
  const { repo, parsed } = await setup();
  await repo.upsertMany(parsed, SYNCED_AT);

  expect(await repo.listIdsInRange('2026-08-21T00:00:00.000Z', '2026-08-23T23:59:59.999Z')).toEqual(
    [1002],
  );
  expect(
    (await repo.listIdsInRange('2026-08-01T00:00:00.000Z', '2026-08-31T00:00:00.000Z')).sort(),
  ).toEqual([1001, 1002]);
  expect(await repo.listIdsInRange('2027-01-01T00:00:00.000Z', '2027-01-02T00:00:00.000Z')).toEqual(
    [],
  );
});

test('listAll returns every workout newest first with durations', async () => {
  const { repo, parsed } = await setup();
  const withDuration = structuredClone(parsed);
  withDuration[0].workout.durationS = 7609;
  await repo.upsertMany(withDuration, SYNCED_AT);

  const all = await repo.listAll();
  expect(all.map((w) => w.lyftaId)).toEqual([1002, 1001]);
  expect(all[1]).toEqual(withDuration[0].workout);
  expect(all[1].durationS).toBe(7609);
});

test('listRaw returns stored raw JSON and sync time', async () => {
  const { repo, parsed } = await setup();
  await repo.upsertMany(parsed, SYNCED_AT);

  const raw = await repo.listRaw();
  expect(raw.map((r) => r.lyftaId).sort()).toEqual([1001, 1002]);
  expect(raw.every((r) => r.syncedAt === SYNCED_AT)).toBe(true);
  const first = raw.find((r) => r.lyftaId === 1001);
  expect(first?.rawJson).toBe(parsed[0].rawJson);
});

test('listAll never sees a half-written workout during an upsert', async () => {
  const { repo, parsed } = await setup();
  // Not awaited: listAll is issued while the upsert's transaction is still open.
  const writing = repo.upsertMany(parsed, SYNCED_AT);
  const all = await repo.listAll();
  await writing;

  expect(all).toHaveLength(2);
  expect(all.map((w) => w.exercises.map((e) => e.sets.length))).toEqual(
    [parsed[1], parsed[0]].map((p) => p.workout.exercises.map((e) => e.sets.length)),
  );
});
