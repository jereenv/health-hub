import { LB_TO_KG, parseWorkoutPage, WORKOUT_PARSER_VERSION } from '@/data/lyfta/parseWorkouts';
import { createSqliteSettingsRepository } from '@/data/settings/SettingsRepository';
import { openTestDatabase } from '@/test-support/sqljsDatabase';

import { ensureWorkoutsParsed } from './reparseStoredWorkouts';
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
  // Not saved, so the next run retries the skipped row.
  expect(await settings.get('lyfta.parsedWith')).toBeNull();
});

test('counts a stored workout that parses as JSON but not as a workout', async () => {
  const { workouts, settings, parsed } = await setup('kg');
  const broken = structuredClone(parsed);
  broken[0].rawJson = '{}';
  await workouts.upsertMany(broken, SYNCED_AT);

  expect(await ensureWorkoutsParsed({ workouts, settings })).toEqual({ reparsed: 1, skipped: 1 });
  expect(await settings.get('lyfta.parsedWith')).toBeNull();
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
