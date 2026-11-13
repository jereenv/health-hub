import type { SqlDatabase } from '@/data/db/SqlDatabase';

/**
 * Deletes everything that came from syncing: workouts (their exercises and sets cascade),
 * the schedule and the sync progress. The saved key, settings and profile are kept, so the next
 * sync is a fresh backfill with the same account. All in one transaction: it either all goes or
 * none of it does.
 */
export async function wipeSyncedData(db: SqlDatabase): Promise<void> {
  await db.transaction(async () => {
    await db.run('DELETE FROM workout');
    await db.run('DELETE FROM scheduled_workout');
    await db.run('DELETE FROM sync_state');
  });
}
