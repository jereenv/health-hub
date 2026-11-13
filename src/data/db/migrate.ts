import type { SqlDatabase } from './SqlDatabase';

/**
 * Applies pending migrations in order and returns the final `user_version`.
 *
 * Each step and its version bump share one transaction, so a failing step
 * rolls back completely and the database stays at its previous version.
 */
export async function migrate(db: SqlDatabase, migrations: readonly string[]): Promise<number> {
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (let version = current; version < migrations.length; version += 1) {
    const step = migrations[version];
    if (step === undefined) {
      continue;
    }
    await db.transaction(async () => {
      await db.exec(step);
      // PRAGMA cannot take bound parameters; `version + 1` is an integer we control.
      await db.exec(`PRAGMA user_version = ${version + 1}`);
    });
  }

  return Math.max(current, migrations.length);
}
