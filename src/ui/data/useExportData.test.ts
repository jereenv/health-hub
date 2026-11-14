import { createSqliteBodyRepository } from '@/data/body/BodyRepository';
import { createSqliteHealthConnectRepository } from '@/data/healthconnect/HealthConnectRepository';
import { createSqliteProfileRepository } from '@/data/profile/ProfileRepository';
import { createSqliteScheduleRepository } from '@/data/schedule/ScheduleRepository';
import { createSqliteWorkoutRepository } from '@/data/workouts/sqliteWorkoutRepository';
import { openTestDatabase } from '@/test-support/sqljsDatabase';

import { loadExportData } from './useExportData';

// The hook is not under test; these keep the app container (native modules) out of Jest.
jest.mock('@/bootstrap/ContainerContext', () => ({ useContainer: () => ({}) }));
jest.mock('./useSyncSnapshot', () => ({ useSyncSnapshot: () => ({ dataVersion: 0 }) }));

async function containerParts() {
  const db = await openTestDatabase();
  return {
    workouts: createSqliteWorkoutRepository(db),
    schedule: createSqliteScheduleRepository(db),
    body: createSqliteBodyRepository(db),
    profile: createSqliteProfileRepository(db),
    healthConnect: createSqliteHealthConnectRepository(db),
  };
}

test('loadExportData returns workouts, a wide schedule range, readings, profile versions, watch checks, activity, sleep and heart rate', async () => {
  const c = await containerParts();
  const at = '2026-11-13T10:00:00.000Z';
  await c.healthConnect.applyImport({
    from: '2026-11-01',
    activity: [
      { date: '2026-11-02', steps: 1000, distanceM: null, activeKcal: null, totalKcal: null },
    ],
    sleep: [
      {
        hcId: 's1',
        startAt: '2026-11-01T22:00:00.000Z',
        endAt: '2026-11-02T06:00:00.000Z',
        wakeDate: '2026-11-02',
        asleepS: 25000,
        awakeS: 0,
        lightS: null,
        deepS: null,
        remS: null,
        hasStages: false,
      },
    ],
    heartRate: [{ date: '2026-11-02', minBpm: 50, avgBpm: 70, maxBpm: 150 }],
    watchBodyFat: [
      { hcId: 'f1', measuredAt: '2026-11-02T12:00:00.000Z', bodyFatPct: 20, origin: 'watch' },
    ],
    weighIns: [
      {
        measuredAt: '2026-11-02T12:00:00.000Z',
        weightKg: 80,
        sourceRecordId: 'w1',
        rawPayload: '{}',
        bodyFatPct: 18,
      },
    ],
    syncedAt: at,
  });
  await c.schedule.replaceRange(
    '2026-11-01',
    '2026-11-30',
    [
      {
        item: {
          lyftaId: 'p1',
          date: '2026-11-05',
          title: 'Upper',
          templateId: null,
          source: null,
          status: null,
          completed: false,
        },
        rawJson: '{}',
      },
    ],
    at,
    false,
  );
  await c.profile.save(
    { heightCm: 175, birthDate: '1995-06-15', sex: 'male', goalWeightKg: 75, bmiCutoffs: 'who' },
    '2026-01-01T00:00:00.000Z',
  );

  const data = await loadExportData(c);
  expect(data.workouts).toEqual([]);
  expect(data.schedule.map((item) => item.date)).toEqual(['2026-11-05']);
  expect(data.readings).toHaveLength(1);
  expect(data.versions).toHaveLength(1);
  expect(data.watch).toHaveLength(1);
  expect(data.activity.map((day) => day.steps)).toEqual([1000]);
  expect(data.sleep).toHaveLength(1);
  expect(data.heartRate).toHaveLength(1);
});

test('loadExportData on an empty database returns empty arrays and does not throw', async () => {
  expect(await loadExportData(await containerParts())).toEqual({
    workouts: [],
    schedule: [],
    readings: [],
    versions: [],
    watch: [],
    activity: [],
    sleep: [],
    heartRate: [],
  });
});
