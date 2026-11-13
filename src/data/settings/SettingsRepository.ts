import type { SqlDatabase } from '@/data/db/SqlDatabase';

/** Known setting keys; a closed union keeps typos out of call sites. */
export type SettingKey = 'lyfta.weightUnit';

export interface SettingsRepository {
  /** Returns null when the setting has never been set. */
  get(key: SettingKey): Promise<string | null>;
  set(key: SettingKey, value: string): Promise<void>;
}

/** SQLite-backed key/value settings; `set` is a single upsert. */
export function createSqliteSettingsRepository(db: SqlDatabase): SettingsRepository {
  return {
    async get(key) {
      const row = await db.first<{ value: string }>('SELECT value FROM setting WHERE key = ?', [
        key,
      ]);
      return row?.value ?? null;
    },

    async set(key, value) {
      await db.run(
        `INSERT INTO setting (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, value],
      );
    },
  };
}
