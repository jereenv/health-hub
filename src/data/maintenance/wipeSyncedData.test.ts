import { createSqliteProfileRepository } from '@/data/profile/ProfileRepository';
import { createSqliteScheduleRepository } from '@/data/schedule/ScheduleRepository';
import { createSqliteSettingsRepository } from '@/data/settings/SettingsRepository';
import { createSqliteSyncStateRepository } from '@/data/sync/SyncStateRepository';
import { createSqliteWorkoutRepository } from '@/data/workouts/sqliteWorkoutRepository';
import { parseSchedulePage } from '@/data/lyfta/parseSchedule';
import { parseWorkoutPage } from '@/data/lyfta/parseWorkouts';
import { openTestDatabase } from '@/test-support/sqljsDatabase';

import { wipeSyncedData } from './wipeSyncedData';

const sandbox = require('@/data/lyfta/__fixtures__/sandbox-workouts.json');

const scheduleFixture = require('@/data/lyfta/__fixtures__/schedule-page.json');

const AT = '2026-11-12T10:00:00.000Z';

async function count(db: Awaited<ReturnType<typeof openTestDatabase>>, table: string) {
  const row = await db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
  return row?.n;
}

test('wipeSyncedData deletes workouts, sets, schedule and sync state only', async () => {
  const db = await openTestDatabase();
  const workouts = createSqliteWorkoutRepository(db);
  const schedule = createSqliteScheduleRepository(db);
  const syncState = createSqliteSyncStateRepository(db);
  const settings = createSqliteSettingsRepository(db);
  const profile = createSqliteProfileRepository(db);

  await workouts.upsertMany(parseWorkoutPage(sandbox, 'kg').workouts, AT);
  await schedule.replaceRange(
    '2026-01-01',
    '2026-01-31',
    parseSchedulePage(scheduleFixture).items,
    AT,
    true,
  );
  await syncState.recordSuccess('lyfta', AT, null);
  await settings.set('display.weightUnit', 'lb');
  await profile.save(
    { heightCm: 180, birthDate: null, sex: null, goalWeightKg: null, bmiCutoffs: 'who' },
    AT,
  );
  expect(await count(db, 'workout_set')).toBeGreaterThan(0);
  expect(await schedule.count()).toBeGreaterThan(0);

  await wipeSyncedData(db);

  expect(await count(db, 'workout')).toBe(0);
  expect(await count(db, 'workout_exercise')).toBe(0);
  expect(await count(db, 'workout_set')).toBe(0);
  expect(await count(db, 'scheduled_workout')).toBe(0);
  expect(await count(db, 'sync_state')).toBe(0);
  expect(await settings.get('display.weightUnit')).toBe('lb');
  expect((await profile.getCurrent())?.heightCm).toBe(180);
});
