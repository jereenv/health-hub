import type { BodyRepository } from '@/data/body/BodyRepository';
import { createSqliteBodyRepository } from '@/data/body/BodyRepository';
import type { BleReadingRepository } from '@/data/body/bleReadings';
import { createSqliteBleReadingRepository } from '@/data/body/bleReadings';
import { openExpoSqlDatabase } from '@/data/db/expoSqlDatabase';
import { migrate } from '@/data/db/migrate';
import { DATABASE_NAME, MIGRATIONS } from '@/data/db/schema';
import type { ExportDelivery } from '@/data/export/ExportDelivery';
import { createExpoExportDelivery } from '@/data/export/expoExportDelivery';
import { createExpoHealthConnectGateway } from '@/data/healthconnect/expoHealthConnectGateway';
import { syncHealthConnect } from '@/data/healthconnect/healthConnectSync';
import type { HealthConnectGateway } from '@/data/healthconnect/HealthConnectGateway';
import type { HealthConnectRepository } from '@/data/healthconnect/HealthConnectRepository';
import { createSqliteHealthConnectRepository } from '@/data/healthconnect/HealthConnectRepository';
import { createLyftaClient } from '@/data/lyfta/LyftaClient';
import { wipeSyncedData } from '@/data/maintenance/wipeSyncedData';
import type { ProfileRepository } from '@/data/profile/ProfileRepository';
import { createSqliteProfileRepository } from '@/data/profile/ProfileRepository';
import { createExpoBleScaleTransport } from '@/data/scale/expoBleScaleTransport';
import type { ScaleRunner } from '@/data/scale/scaleRunner';
import { createScaleRunner } from '@/data/scale/scaleRunner';
import type { ScheduleRepository } from '@/data/schedule/ScheduleRepository';
import { createSqliteScheduleRepository } from '@/data/schedule/ScheduleRepository';
import { createExpoSecretStore } from '@/data/secrets/expoSecretStore';
import type { SecretStore } from '@/data/secrets/SecretStore';
import { SECRET_KEYS } from '@/data/secrets/SecretStore';
import type { PreferencesStore } from '@/data/settings/preferences';
import { createPreferencesStore } from '@/data/settings/preferences';
import type { SettingsRepository } from '@/data/settings/SettingsRepository';
import { createSqliteSettingsRepository } from '@/data/settings/SettingsRepository';
import type { SyncCoordinator } from '@/data/sync/syncCoordinator';
import { createSyncCoordinator } from '@/data/sync/syncCoordinator';
import type { SyncStateRepository } from '@/data/sync/SyncStateRepository';
import { createSqliteSyncStateRepository } from '@/data/sync/SyncStateRepository';
import { createSqliteWorkoutRepository } from '@/data/workouts/sqliteWorkoutRepository';
import type { WorkoutRepository } from '@/data/workouts/WorkoutRepository';

import { localDateKey } from '@/domain/time/localDate';

import { memoizeAsync } from './memoizeAsync';

/** Everything the screens need, built once at app start. */
export interface AppContainer {
  workouts: WorkoutRepository;
  schedule: ScheduleRepository;
  syncState: SyncStateRepository;
  settings: SettingsRepository;
  profile: ProfileRepository;
  body: BodyRepository;
  /** Saves Bluetooth scale weigh-ins with cross-source dedupe. */
  bleReadings: BleReadingRepository;
  /** The foreground Bluetooth scale session (Today card). */
  scale: ScaleRunner;
  preferences: PreferencesStore;
  secrets: SecretStore;
  healthConnect: HealthConnectRepository;
  /** The only door to Health Connect (permissions, availability, reads). */
  healthConnectGateway: HealthConnectGateway;
  /** The only way to sync or wipe: it keeps those operations from overlapping. */
  sync: SyncCoordinator;
  /** Share sheet, clipboard and the export cache folder. */
  exportDelivery: ExportDelivery;
}

/** Opens and migrates the database, then wires repositories, secret store and the sync coordinator. */
async function createAppContainer(): Promise<AppContainer> {
  const db = await openExpoSqlDatabase(DATABASE_NAME);
  await migrate(db, MIGRATIONS);

  const workouts = createSqliteWorkoutRepository(db);
  const schedule = createSqliteScheduleRepository(db);
  const syncState = createSqliteSyncStateRepository(db);
  const settings = createSqliteSettingsRepository(db);
  const profile = createSqliteProfileRepository(db);
  const body = createSqliteBodyRepository(db);
  const preferences = await createPreferencesStore(settings);
  const secrets = createExpoSecretStore();
  const healthConnect = createSqliteHealthConnectRepository(db);
  const healthConnectGateway = createExpoHealthConnectGateway();
  const client = createLyftaClient({
    fetchFn: fetch,
    getApiKey: () => secrets.get(SECRET_KEYS.lyftaApiKey),
  });
  const sync = createSyncCoordinator({
    client,
    workouts,
    schedule,
    syncState,
    settings,
    secrets,
    preferences,
    syncHealthConnect: () =>
      syncHealthConnect({
        gateway: healthConnectGateway,
        repository: healthConnect,
        syncState,
        now: () => new Date(),
      }),
    wipeSyncedData: () => wipeSyncedData(db),
    now: () => new Date(),
  });

  const bleReadings = createSqliteBleReadingRepository(db);
  const scale = createScaleRunner({
    transport: createExpoBleScaleTransport(),
    now: () => new Date(),
    nowMs: () => Date.now(),
    async loadProfile() {
      const current = await profile.getCurrent();
      const readings = await body.listReadings();
      return {
        sex: current?.sex ?? null,
        heightCm: current?.heightCm ?? null,
        birthDate: current?.birthDate ?? null,
        lastWeightKg: readings[readings.length - 1]?.weightKg ?? null,
        today: localDateKey(new Date()),
      };
    },
    getRememberedId: () => settings.get('ble.scaleDeviceId'),
    rememberId: (id) => settings.set('ble.scaleDeviceId', id),
    saveReading: (reading) => bleReadings.saveReading(reading),
    onSaved: () => sync.notifyDataChanged(),
    delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });

  return {
    workouts,
    schedule,
    syncState,
    settings,
    profile,
    body,
    bleReadings,
    scale,
    preferences,
    secrets,
    healthConnect,
    healthConnectGateway,
    sync,
    exportDelivery: createExpoExportDelivery(),
  };
}

const appContainer = memoizeAsync(createAppContainer);

/**
 * The app's single container. Every caller gets the same one, so a remount or Fast Refresh never
 * opens a second database connection or builds a second coordinator.
 */
export function getAppContainer(): Promise<AppContainer> {
  return appContainer.get();
}

/** Forgets the container so the next `getAppContainer()` builds a fresh one (the "Try again" path). */
export function resetAppContainer(): void {
  appContainer.reset();
}
