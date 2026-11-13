import type { SqlDatabase } from '@/data/db/SqlDatabase';

/** Data sources that sync into the app. Later plans widen this union. */
export type SyncSource = 'lyfta';

/** Where a source's sync stopped, and how its last attempts went. */
export interface SyncState {
  source: SyncSource;
  cursor: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
}

export interface SyncStateRepository {
  /** Returns an all-null state when the source has never synced. */
  get(source: SyncSource): Promise<SyncState>;
  /** Persists backfill progress without touching success or error bookkeeping. */
  saveCursor(source: SyncSource, cursor: string | null): Promise<void>;
  /** Records a finished sync and clears any earlier error. */
  recordSuccess(source: SyncSource, at: string, cursor: string | null): Promise<void>;
  /** Records a failure but keeps the last success time and cursor, so progress survives. */
  recordError(source: SyncSource, message: string, at: string): Promise<void>;
}

interface SyncStateRow {
  source: string;
  cursor: string | null;
  last_success_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
}

/** SQLite-backed repository; each method is one upsert statement, so no transaction is needed. */
export function createSqliteSyncStateRepository(db: SqlDatabase): SyncStateRepository {
  return {
    async get(source) {
      const row = await db.first<SyncStateRow>(
        'SELECT source, cursor, last_success_at, last_error, last_error_at FROM sync_state WHERE source = ?',
        [source],
      );
      return {
        source,
        cursor: row?.cursor ?? null,
        lastSuccessAt: row?.last_success_at ?? null,
        lastError: row?.last_error ?? null,
        lastErrorAt: row?.last_error_at ?? null,
      };
    },

    async saveCursor(source, cursor) {
      await db.run(
        `INSERT INTO sync_state (source, cursor) VALUES (?, ?)
         ON CONFLICT(source) DO UPDATE SET cursor = excluded.cursor`,
        [source, cursor],
      );
    },

    async recordSuccess(source, at, cursor) {
      await db.run(
        `INSERT INTO sync_state (source, cursor, last_success_at) VALUES (?, ?, ?)
         ON CONFLICT(source) DO UPDATE SET
           cursor = excluded.cursor,
           last_success_at = excluded.last_success_at,
           last_error = NULL,
           last_error_at = NULL`,
        [source, cursor, at],
      );
    },

    async recordError(source, message, at) {
      await db.run(
        `INSERT INTO sync_state (source, last_error, last_error_at) VALUES (?, ?, ?)
         ON CONFLICT(source) DO UPDATE SET
           last_error = excluded.last_error,
           last_error_at = excluded.last_error_at`,
        [source, message, at],
      );
    },
  };
}
