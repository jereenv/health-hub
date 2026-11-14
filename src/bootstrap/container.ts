import type { BodyRepository } from '@/data/body/BodyRepository';
import { createSqliteBodyRepository } from '@/data/body/BodyRepository';
import { openExpoSqlDatabase } from '@/data/db/expoSqlDatabase';
import { migrate } from '@/data/db/migrate';
import { DATABASE_NAME, MIGRATIONS } from '@/data/db/schema';
import { createExpoHealthConnectGateway } from '@/data/healthconnect/expoHealthConnectGateway';
import { syncHealthConnect } from '@/data/healthconnect/healthConnectSync';
import type { HealthConnectGateway } from '@/data/healthconnect/HealthConnectGateway';
import type { HealthConnectRepository } from '@/data/healthconnect/HealthConnectRepository';
import { createSqliteHealthConnectRepository } from '@/data/healthconnect/HealthConnectRepository';
import { createLyftaClient } from '@/data/lyfta/LyftaClient';
import { wipeSyncedData } from '@/data/maintenance/wipeSyncedData';
import type { ProfileRepository } from '@/data/profile/ProfileRepository';
import { createSqliteProfileRepository } from '@/data/profile/ProfileRepository';
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

import { memoizeAsync } from './memoizeAsync';

/** Everything the screens need, built once at app start. */
export interface AppContainer {
  workouts: WorkoutRepository;
  schedule: ScheduleRepository;
  syncState: SyncStateRepository;
  settings: SettingsRepository;
  profile: ProfileRepository;
  body: BodyRepository;
  preferences: PreferencesStore;
  secrets: SecretStore;
  healthConnect: HealthConnectRepository;
  /** The only door to Health Connect (permissions, availability, reads). */
  healthConnectGateway: HealthConnectGateway;
  /** The only way to sync or wipe: it keeps those operations from overlapping. */
  sync: SyncCoordinator;
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

  return {
    workouts,
    schedule,
    syncState,
    settings,
    profile,
    body,
    preferences,
    secrets,
    healthConnect,
    healthConnectGateway,
    sync,
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
