import type { SqlDatabase } from '@/data/db/SqlDatabase';

/**
 * Deletes everything that came from syncing: workouts (their exercises and sets cascade),
 * the schedule, the Health Connect imports and the sync progress. The saved key, settings and profile are kept, so the next
 * sync is a fresh backfill with the same account. All in one transaction: it either all goes or
 * none of it does.
 */
export async function wipeSyncedData(db: SqlDatabase): Promise<void> {
  await db.transaction(async () => {
    await db.run('DELETE FROM workout');
    await db.run('DELETE FROM scheduled_workout');
    await db.run('DELETE FROM activity_daily');
    await db.run('DELETE FROM sleep_session');
    await db.run('DELETE FROM heart_rate_daily');
    await db.run('DELETE FROM watch_body_fat');
    // legacy_body_value rows cascade. Readings from other sources (BLE) cannot be re-downloaded.
    await db.run("DELETE FROM scale_reading WHERE source = 'health_connect'");
    await db.run('DELETE FROM sync_state');
  });
}
