import { LB_TO_KG, parseWorkoutPage, WORKOUT_PARSER_VERSION } from '@/data/lyfta/parseWorkouts';
import { createSqliteSettingsRepository } from '@/data/settings/SettingsRepository';
import { openTestDatabase } from '@/test-support/sqljsDatabase';

import { ensureWorkoutsParsed, markWorkoutsParsed } from './reparseStoredWorkouts';
import { createSqliteWorkoutRepository } from './sqliteWorkoutRepository';

const sandbox = require('@/data/lyfta/__fixtures__/sandbox-workouts.json');

const SYNCED_AT = '2026-11-12T10:00:00.000Z';

async function setup(unit: 'kg' | 'lb' | null = 'kg') {
  const db = await openTestDatabase();
  const workouts = createSqliteWorkoutRepository(db);
  const settings = createSqliteSettingsRepository(db);
  if (unit !== null) await settings.set('lyfta.weightUnit', unit);
  const parsed = parseWorkoutPage(sandbox, 'kg').workouts;
  return { workouts, settings, parsed };
}

test('reparses every stored workout when the parser version changed', async () => {
  const { workouts, settings, parsed } = await setup('kg');
  const mangled = structuredClone(parsed);
  mangled[0].workout.exercises[0].sets[0].weightKg = 1;
  await workouts.upsertMany(mangled, SYNCED_AT);
  await settings.set('lyfta.parsedWith', JSON.stringify({ version: 0, unit: 'kg' }));

  expect(await ensureWorkoutsParsed({ workouts, settings })).toEqual({ reparsed: 2, skipped: 0 });

  expect((await workouts.get(1001))?.exercises[0].sets[0].weightKg).toBe(80);
  expect(JSON.parse((await settings.get('lyfta.parsedWith')) ?? 'null')).toEqual({
    version: WORKOUT_PARSER_VERSION,
    unit: 'kg',
    skipped: 0,
  });
});

test('converts stored workouts again when the unit changed', async () => {
  const { workouts, settings, parsed } = await setup('lb');
  await workouts.upsertMany(parsed, SYNCED_AT);
  await settings.set(
    'lyfta.parsedWith',
    JSON.stringify({ version: WORKOUT_PARSER_VERSION, unit: 'kg' }),
  );

  await ensureWorkoutsParsed({ workouts, settings });

  expect((await workouts.get(1001))?.exercises[0].sets[0].weightKg).toBeCloseTo(80 * LB_TO_KG);
  expect(JSON.parse((await settings.get('lyfta.parsedWith')) ?? 'null')).toEqual({
    version: WORKOUT_PARSER_VERSION,
    unit: 'lb',
    skipped: 0,
  });
});

test('does nothing when no unit is stored', async () => {
  const { workouts, settings, parsed } = await setup(null);
  await workouts.upsertMany(parsed, SYNCED_AT);
  const upsert = jest.spyOn(workouts, 'upsertMany');

  expect(await ensureWorkoutsParsed({ workouts, settings })).toBeNull();
  expect(upsert).not.toHaveBeenCalled();
  expect(await settings.get('lyfta.parsedWith')).toBeNull();
});

test('does nothing when already parsed with this version and unit', async () => {
  const { workouts, settings, parsed } = await setup('kg');
  await workouts.upsertMany(parsed, SYNCED_AT);
  await settings.set(
    'lyfta.parsedWith',
    JSON.stringify({ version: WORKOUT_PARSER_VERSION, unit: 'kg' }),
  );
  const upsert = jest.spyOn(workouts, 'upsertMany');

  expect(await ensureWorkoutsParsed({ workouts, settings })).toBeNull();
  expect(upsert).not.toHaveBeenCalled();
});

test.each(['not json', '{"version":"2","unit":"kg"}', '{"version":2,"unit":"stone"}', 'null', '7'])(
  'treats parsedWith %p as not parsed',
  async (stored) => {
    const { workouts, settings, parsed } = await setup('kg');
    await workouts.upsertMany(parsed, SYNCED_AT);
    await settings.set('lyfta.parsedWith', stored);

    expect(await ensureWorkoutsParsed({ workouts, settings })).toEqual({
      reparsed: 2,
      skipped: 0,
    });
  },
);

test('keeps a stored workout whose raw JSON no longer parses and counts it', async () => {
  const { workouts, settings, parsed } = await setup('kg');
  const broken = structuredClone(parsed);
  broken[0].rawJson = '{not json';
  broken[0].workout.exercises[0].sets[0].weightKg = 1;
  await workouts.upsertMany(broken, SYNCED_AT);

  expect(await ensureWorkoutsParsed({ workouts, settings })).toEqual({ reparsed: 1, skipped: 1 });

  // The unparseable row is untouched; the other row was re-parsed.
  expect((await workouts.get(1001))?.exercises[0].sets[0].weightKg).toBe(1);
  expect(await workouts.get(1002)).toEqual(parsed[1].workout);
  // Saved with the count: re-parsing the same raw JSON would fail the same way, so the next run
  // has nothing to do.
  expect(JSON.parse((await settings.get('lyfta.parsedWith')) ?? 'null')).toEqual({
    version: WORKOUT_PARSER_VERSION,
    unit: 'kg',
    skipped: 1,
  });
  expect(await ensureWorkoutsParsed({ workouts, settings })).toBeNull();
});

test('counts a stored workout that parses as JSON but not as a workout', async () => {
  const { workouts, settings, parsed } = await setup('kg');
  const broken = structuredClone(parsed);
  broken[0].rawJson = '{}';
  await workouts.upsertMany(broken, SYNCED_AT);

  expect(await ensureWorkoutsParsed({ workouts, settings })).toEqual({ reparsed: 1, skipped: 1 });
  expect(JSON.parse((await settings.get('lyfta.parsedWith')) ?? 'null')).toMatchObject({
    skipped: 1,
  });
  expect(await ensureWorkoutsParsed({ workouts, settings })).toBeNull();
});

test('leaves parsedWith unsaved when a database write throws', async () => {
  const { workouts, settings, parsed } = await setup('kg');
  await workouts.upsertMany(parsed, SYNCED_AT);
  jest.spyOn(workouts, 'upsertMany').mockRejectedValue(new Error('db down'));

  await expect(ensureWorkoutsParsed({ workouts, settings })).rejects.toThrow('db down');
  expect(await settings.get('lyfta.parsedWith')).toBeNull();
});

test('compares only the version and unit, so any skipped count counts as parsed', async () => {
  const { workouts, settings, parsed } = await setup('kg');
  await workouts.upsertMany(parsed, SYNCED_AT);
  await settings.set(
    'lyfta.parsedWith',
    JSON.stringify({ version: WORKOUT_PARSER_VERSION, unit: 'kg', skipped: 5 }),
  );
  expect(await ensureWorkoutsParsed({ workouts, settings })).toBeNull();
});

test.each(['missing', -1, 'x', 1.5])('reads skipped %p as 0', async (skipped) => {
  const { workouts, settings, parsed } = await setup('kg');
  await workouts.upsertMany(parsed, SYNCED_AT);
  const saved: Record<string, unknown> = { version: 0, unit: 'kg' };
  if (skipped !== 'missing') saved.skipped = skipped;
  await settings.set('lyfta.parsedWith', JSON.stringify(saved));
  // An older version re-parses; the stored value is replaced by a clean count.
  expect(await ensureWorkoutsParsed({ workouts, settings })).toEqual({ reparsed: 2, skipped: 0 });

  await settings.set(
    'lyfta.parsedWith',
    JSON.stringify({ ...saved, version: WORKOUT_PARSER_VERSION }),
  );
  // Same version and unit: parsed regardless of the odd skipped value.
  expect(await ensureWorkoutsParsed({ workouts, settings })).toBeNull();
});

test('markWorkoutsParsed saves the current parser version and the unit', async () => {
  const { settings } = await setup('kg');
  await markWorkoutsParsed(settings, 'lb');
  expect(JSON.parse((await settings.get('lyfta.parsedWith')) ?? 'null')).toEqual({
    version: WORKOUT_PARSER_VERSION,
    unit: 'lb',
    skipped: 0,
  });
});

test("keeps each workout's original synced_at", async () => {
  const { workouts, settings, parsed } = await setup('kg');
  await workouts.upsertMany([parsed[0]], '2026-10-01T08:00:00.000Z');
  await workouts.upsertMany([parsed[1]], '2026-11-01T09:00:00.000Z');

  await ensureWorkoutsParsed({ workouts, settings });

  const syncedAt = Object.fromEntries(
    (await workouts.listRaw()).map((r) => [r.lyftaId, r.syncedAt]),
  );
  expect(syncedAt).toEqual({
    1001: '2026-10-01T08:00:00.000Z',
    1002: '2026-11-01T09:00:00.000Z',
  });
});
