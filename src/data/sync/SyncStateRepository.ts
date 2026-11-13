import type { SqlDatabase } from '@/data/db/SqlDatabase';

/** Data sources that sync into the app. Later plans widen this union. */
export type SyncSource = 'lyfta';

/** Why deleting workouts that vanished from Lyfta is on hold, and which workouts are affected. */
export interface DeletionPause {
  /** `unreadable`: Lyfta returned workouts we cannot parse; `error`: the confirmation listing failed. */
  reason: 'unreadable' | 'error';
  /** Local workouts that look deleted, ascending. Empty when the run skipped before finding any. */
  candidateIds: number[];
  skipped: number;
}

/** Sync health recorded with a successful run. */
export interface SuccessDetails {
  skipped: number;
  deletionPause: DeletionPause | null;
}

/** Where a source's sync stopped, and how its last attempts went. */
export interface SyncState {
  source: SyncSource;
  cursor: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  /** Workouts the last successful run could not parse. */
  lastSkipped: number;
  deletionPause: DeletionPause | null;
}

export interface SyncStateRepository {
  /** Returns an all-null state when the source has never synced. */
  get(source: SyncSource): Promise<SyncState>;
  /** Persists backfill progress without touching success or error bookkeeping. */
  saveCursor(source: SyncSource, cursor: string | null): Promise<void>;
  /** Records a finished sync and clears any earlier error; `details` defaults to nothing skipped. */
  recordSuccess(
    source: SyncSource,
    at: string,
    cursor: string | null,
    details?: SuccessDetails,
  ): Promise<void>;
  /** Forgets cursor, last success, errors, skipped count and deletion pause, so the next sync starts from scratch. */
  reset(source: SyncSource): Promise<void>;
  /** Records a failure but keeps the last success time and cursor, so progress survives. */
  recordError(source: SyncSource, message: string, at: string): Promise<void>;
}

interface SyncStateRow {
  source: string;
  cursor: string | null;
  last_success_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
  last_skipped: number;
  deletion_pause: string | null;
}

/** Reads a stored pause; anything malformed counts as no pause so a bad row never breaks sync. */
function parseDeletionPause(stored: string | null): DeletionPause | null {
  if (stored === null) return null;
  try {
    const value: unknown = JSON.parse(stored);
    if (typeof value !== 'object' || value === null) return null;
    const { reason, candidateIds, skipped } = value as Record<string, unknown>;
    if (reason !== 'unreadable' && reason !== 'error') return null;
    if (!Array.isArray(candidateIds) || !candidateIds.every(Number.isInteger)) return null;
    if (typeof skipped !== 'number' || !Number.isInteger(skipped) || skipped < 0) return null;
    return { reason, candidateIds: candidateIds as number[], skipped };
  } catch {
    return null;
  }
}

/** SQLite-backed repository; each method is one upsert statement, so no transaction is needed. */
export function createSqliteSyncStateRepository(db: SqlDatabase): SyncStateRepository {
  return {
    async get(source) {
      const row = await db.first<SyncStateRow>(
        `SELECT source, cursor, last_success_at, last_error, last_error_at, last_skipped, deletion_pause
         FROM sync_state WHERE source = ?`,
        [source],
      );
      return {
        source,
        cursor: row?.cursor ?? null,
        lastSuccessAt: row?.last_success_at ?? null,
        lastError: row?.last_error ?? null,
        lastErrorAt: row?.last_error_at ?? null,
        lastSkipped: row?.last_skipped ?? 0,
        deletionPause: parseDeletionPause(row?.deletion_pause ?? null),
      };
    },

    async saveCursor(source, cursor) {
      await db.run(
        `INSERT INTO sync_state (source, cursor) VALUES (?, ?)
         ON CONFLICT(source) DO UPDATE SET cursor = excluded.cursor`,
        [source, cursor],
      );
    },

    async recordSuccess(source, at, cursor, details = { skipped: 0, deletionPause: null }) {
      const pause = details.deletionPause === null ? null : JSON.stringify(details.deletionPause);
      await db.run(
        `INSERT INTO sync_state (source, cursor, last_success_at, last_skipped, deletion_pause)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(source) DO UPDATE SET
           cursor = excluded.cursor,
           last_success_at = excluded.last_success_at,
           last_skipped = excluded.last_skipped,
           deletion_pause = excluded.deletion_pause,
           last_error = NULL,
           last_error_at = NULL`,
        [source, cursor, at, details.skipped, pause],
      );
    },

    async reset(source) {
      await db.run('DELETE FROM sync_state WHERE source = ?', [source]);
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
