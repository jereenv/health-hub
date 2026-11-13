import type { ParsedScheduledWorkout } from '@/data/lyfta/parseSchedule';
import type { SqlDatabase } from '@/data/db/SqlDatabase';
import type { DateKey } from '@/domain/time/localDate';
import type { ScheduledWorkout } from '@/domain/workouts/schedule';

export interface ScheduleRepository {
  /**
   * Upserts `items` and, when `deleteMissing`, deletes stored rows dated from..to (inclusive) that
   * are not in `items`. All in one transaction.
   */
  replaceRange(
    from: DateKey,
    to: DateKey,
    items: readonly ParsedScheduledWorkout[],
    syncedAt: string,
    deleteMissing: boolean,
  ): Promise<{ upserted: number; deleted: number }>;
  /** Items dated from..to inclusive, ordered by date then title. */
  listBetween(from: DateKey, to: DateKey): Promise<ScheduledWorkout[]>;
  count(): Promise<number>;
}

interface ScheduleRow {
  lyfta_id: string;
  scheduled_date: string;
  title: string;
  template_id: string | null;
  source: string | null;
  status: string | null;
  completed: number;
}

/** SQLite-backed schedule store. */
export function createSqliteScheduleRepository(db: SqlDatabase): ScheduleRepository {
  return {
    async replaceRange(from, to, items, syncedAt, deleteMissing) {
      return db.transaction(async () => {
        // Collapse duplicate ids within one response; the last occurrence wins, as the upsert would.
        const byId = new Map(items.map((entry) => [entry.item.lyftaId, entry]));
        for (const { item, rawJson } of byId.values()) {
          await db.run(
            `INSERT INTO scheduled_workout
               (lyfta_id, scheduled_date, title, template_id, source, status, completed, raw_json, synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(lyfta_id) DO UPDATE SET
               scheduled_date = excluded.scheduled_date,
               title = excluded.title,
               template_id = excluded.template_id,
               source = excluded.source,
               status = excluded.status,
               completed = excluded.completed,
               raw_json = excluded.raw_json,
               synced_at = excluded.synced_at`,
            [
              item.lyftaId,
              item.date,
              item.title,
              item.templateId,
              item.source,
              item.status,
              item.completed ? 1 : 0,
              rawJson,
              syncedAt,
            ],
          );
        }

        let deleted = 0;
        if (deleteMissing) {
          const keep = new Set(byId.keys());
          const stored = await db.all<{ lyfta_id: string }>(
            'SELECT lyfta_id FROM scheduled_workout WHERE scheduled_date BETWEEN ? AND ?',
            [from, to],
          );
          for (const { lyfta_id } of stored) {
            if (keep.has(lyfta_id)) continue;
            const result = await db.run('DELETE FROM scheduled_workout WHERE lyfta_id = ?', [
              lyfta_id,
            ]);
            deleted += result.changes;
          }
        }
        return { upserted: byId.size, deleted };
      });
    },

    async listBetween(from, to) {
      const rows = await db.all<ScheduleRow>(
        `SELECT lyfta_id, scheduled_date, title, template_id, source, status, completed
         FROM scheduled_workout WHERE scheduled_date BETWEEN ? AND ?
         ORDER BY scheduled_date, title, lyfta_id`,
        [from, to],
      );
      return rows.map((row) => ({
        lyftaId: row.lyfta_id,
        date: row.scheduled_date,
        title: row.title,
        templateId: row.template_id,
        source: row.source,
        status: row.status,
        completed: row.completed === 1,
      }));
    },

    async count() {
      const row = await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM scheduled_workout');
      return row?.n ?? 0;
    },
  };
}
