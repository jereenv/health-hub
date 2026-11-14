import { createSqliteBleReadingRepository } from '@/data/body/bleReadings';
import { createSqliteBodyRepository } from '@/data/body/BodyRepository';
import { createSqliteHealthConnectRepository } from '@/data/healthconnect/HealthConnectRepository';
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

test('wipe also clears the Health Connect tables and health_connect scale readings but keeps a ble reading', async () => {
  const db = await openTestDatabase();
  const healthConnect = createSqliteHealthConnectRepository(db);
  await healthConnect.applyImport({
    from: '2026-11-01',
    activity: [
      { date: '2026-11-01', steps: 1, distanceM: null, activeKcal: null, totalKcal: null },
    ],
    sleep: [
      {
        hcId: 's1',
        startAt: AT,
        endAt: AT,
        wakeDate: '2026-11-01',
        asleepS: 1,
        awakeS: 0,
        lightS: null,
        deepS: null,
        remS: null,
        hasStages: false,
      },
    ],
    heartRate: [{ date: '2026-11-01', minBpm: 50, avgBpm: 60, maxBpm: 70 }],
    watchBodyFat: [{ hcId: 'f1', measuredAt: AT, bodyFatPct: 20, origin: 'watch' }],
    weighIns: [
      { measuredAt: AT, weightKg: 80, sourceRecordId: 'w1', rawPayload: '{}', bodyFatPct: 18 },
    ],
    syncedAt: AT,
  });
  await db.run(
    `INSERT INTO scale_reading (measured_at, weight_kg, source, source_record_id)
     VALUES (?, 79, 'ble', 'b1')`,
    [AT],
  );
  await createSqliteSyncStateRepository(db).recordSuccess('health_connect', AT, null);

  await wipeSyncedData(db);

  expect(await healthConnect.counts()).toEqual({
    activityDays: 0,
    sleepSessions: 0,
    heartRateDays: 0,
    watchBodyFat: 0,
    weighIns: 0,
  });
  expect(await count(db, 'legacy_body_value')).toBe(0);
  expect(await count(db, 'sync_state')).toBe(0);
  expect((await healthConnect.listScaleReadings()).map((r) => r.source)).toEqual(['ble']);
});

test('wipe keeps a ble reading', async () => {
  const db = await openTestDatabase();
  await createSqliteBleReadingRepository(db).saveReading({
    measuredAt: AT,
    weightKg: 80,
    impedanceOhm: 500,
    rawPayload: 'aabbcc',
    deviceId: 'dev-1',
  });
  await db.run(
    `INSERT INTO scale_reading (measured_at, weight_kg, source, source_record_id)
     VALUES ('2026-01-01T00:00:00.000Z', 70, 'health_connect', 'h1')`,
  );

  await wipeSyncedData(db);

  const readings = await createSqliteBodyRepository(db).listReadings();
  expect(readings.map((r) => r.source)).toEqual(['ble']);
  expect(readings[0]?.impedanceOhm).toBe(500);
});
