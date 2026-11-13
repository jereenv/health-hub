import { openExpoSqlDatabase } from '@/data/db/expoSqlDatabase';
import { migrate } from '@/data/db/migrate';
import { DATABASE_NAME, MIGRATIONS } from '@/data/db/schema';
import { createLyftaClient } from '@/data/lyfta/LyftaClient';
import type { LyftaSyncResult } from '@/data/lyfta/lyftaSync';
import { createLyftaSyncRunner } from '@/data/lyfta/lyftaSync';
import { createExpoSecretStore } from '@/data/secrets/expoSecretStore';
import type { SecretStore } from '@/data/secrets/SecretStore';
import { SECRET_KEYS } from '@/data/secrets/SecretStore';
import type { SettingsRepository } from '@/data/settings/SettingsRepository';
import { createSqliteSettingsRepository } from '@/data/settings/SettingsRepository';
import type { SyncStateRepository } from '@/data/sync/SyncStateRepository';
import { createSqliteSyncStateRepository } from '@/data/sync/SyncStateRepository';
import { createSqliteWorkoutRepository } from '@/data/workouts/sqliteWorkoutRepository';
import type { WorkoutRepository } from '@/data/workouts/WorkoutRepository';

/** Everything the screens need, built once at app start. */
export interface AppContainer {
  workouts: WorkoutRepository;
  syncState: SyncStateRepository;
  settings: SettingsRepository;
  secrets: SecretStore;
  lyftaSync: { run(): Promise<LyftaSyncResult> };
}

/** Opens and migrates the database, then wires repositories, secret store and the Lyfta sync. */
export async function createAppContainer(): Promise<AppContainer> {
  const db = await openExpoSqlDatabase(DATABASE_NAME);
  await migrate(db, MIGRATIONS);

  const workouts = createSqliteWorkoutRepository(db);
  const syncState = createSqliteSyncStateRepository(db);
  const settings = createSqliteSettingsRepository(db);
  const secrets = createExpoSecretStore();
  const client = createLyftaClient({
    fetchFn: fetch,
    getApiKey: () => secrets.get(SECRET_KEYS.lyftaApiKey),
  });
  const lyftaSync = createLyftaSyncRunner({
    client,
    workouts,
    syncState,
    settings,
    secrets,
    now: () => new Date(),
  });

  return { workouts, syncState, settings, secrets, lyftaSync };
}
