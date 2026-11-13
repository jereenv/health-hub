import type { SqlDatabase } from './SqlDatabase';

/**
 * One schema step. A plain string is run as-is. A `foreignKeysOff` step may
 * rebuild a table that other tables reference: SQLite's table-rebuild recipe
 * (create new, copy, drop old, rename) needs foreign key enforcement off.
 */
export type Migration = string | { readonly sql: string; readonly foreignKeysOff: true };

/** Thrown when the database was written by a newer app version than this one. */
export class DatabaseTooNewError extends Error {
  readonly found: number;
  readonly supported: number;

  constructor(found: number, supported: number) {
    super(`Database schema version ${found} is newer than the supported version ${supported}`);
    this.name = 'DatabaseTooNewError';
    this.found = found;
    this.supported = supported;
  }
}

async function applyStep(db: SqlDatabase, step: Migration, version: number): Promise<void> {
  const sql = typeof step === 'string' ? step : step.sql;
  const foreignKeysOff = typeof step !== 'string';

  // PRAGMA foreign_keys is ignored inside a transaction, so toggle it outside.
  if (foreignKeysOff) {
    await db.exec('PRAGMA foreign_keys = OFF');
  }
  try {
    await db.transaction(async () => {
      await db.exec(sql);
      if (foreignKeysOff) {
        const violations = await db.all('PRAGMA foreign_key_check');
        if (violations.length > 0) {
          throw new Error(`Migration ${version} left ${violations.length} foreign key violations`);
        }
      }
      // PRAGMA cannot take bound parameters; `version` is an integer we control.
      await db.exec(`PRAGMA user_version = ${version}`);
    });
  } finally {
    if (foreignKeysOff) {
      await db.exec('PRAGMA foreign_keys = ON');
    }
  }
}

/**
 * Applies pending migrations in order and returns the final `user_version`.
 *
 * Each step and its version bump share one transaction, so a failing step
 * rolls back completely and the database stays at its previous version.
 * Throws `DatabaseTooNewError` before running anything if the database is
 * ahead of `migrations`.
 */
export async function migrate(db: SqlDatabase, migrations: readonly Migration[]): Promise<number> {
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current > migrations.length) {
    throw new DatabaseTooNewError(current, migrations.length);
  }

  for (let index = current; index < migrations.length; index += 1) {
    const step = migrations[index];
    if (step === undefined) {
      continue;
    }
    await applyStep(db, step, index + 1);
  }

  return migrations.length;
}
