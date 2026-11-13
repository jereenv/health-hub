import type { SqlDatabase } from '@/data/db/SqlDatabase';
import type { DateKey } from '@/domain/time/localDate';

/** Origin recorded on body fat imported alongside a scale weight. */
const LEGACY_ORIGIN = 'movinglife';
const HEALTH_CONNECT_SOURCE = 'health_connect';

export interface ActivityDay {
  date: DateKey;
  steps: number | null;
  distanceM: number | null;
  activeKcal: number | null;
  totalKcal: number | null;
}

export interface SleepSessionRow {
  hcId: string;
  startAt: string;
  endAt: string;
  wakeDate: DateKey;
  asleepS: number;
  awakeS: number;
  lightS: number | null;
  deepS: number | null;
  remS: number | null;
  hasStages: boolean;
}

export interface HeartRateDay {
  date: DateKey;
  minBpm: number;
  avgBpm: number;
  maxBpm: number;
}

export interface WatchBodyFat {
  hcId: string;
  measuredAt: string;
  bodyFatPct: number;
  origin: string;
}

export interface WeighIn {
  measuredAt: string;
  weightKg: number;
  sourceRecordId: string;
  rawPayload: string;
  bodyFatPct: number | null;
}

export interface ImportPayload {
  from: DateKey;
  activity: ActivityDay[];
  sleep: SleepSessionRow[];
  heartRate: HeartRateDay[];
  watchBodyFat: WatchBodyFat[];
  weighIns: WeighIn[];
  syncedAt: string;
}

export interface ScaleReadingRow {
  id: number;
  measuredAt: string;
  weightKg: number;
  source: string;
  bodyFatPct: number | null;
}

export interface HealthConnectRepository {
  /** One transaction: replaces activity, sleep and heart-rate rows dated `from` or later, replaces ALL watch body fat and ALL scale readings with source 'health_connect'. */
  applyImport(payload: ImportPayload): Promise<void>;
  /** Ascending by date. */
  listActivityDays(): Promise<ActivityDay[]>;
  /** Ascending by end. */
  listSleepSessions(): Promise<SleepSessionRow[]>;
  listHeartRateDays(): Promise<HeartRateDay[]>;
  listWatchBodyFat(): Promise<WatchBodyFat[]>;
  /** Ascending by time; body fat comes from legacy_body_value 'body_fat_pct'. */
  listScaleReadings(): Promise<ScaleReadingRow[]>;
  counts(): Promise<{
    activityDays: number;
    sleepSessions: number;
    heartRateDays: number;
    watchBodyFat: number;
    weighIns: number;
  }>;
}

export function createSqliteHealthConnectRepository(db: SqlDatabase): HealthConnectRepository {
  async function count(sql: string): Promise<number> {
    const row = await db.first<{ n: number }>(sql);
    return row?.n ?? 0;
  }

  return {
    async applyImport(payload) {
      const { from, syncedAt } = payload;
      await db.transaction(async () => {
        await db.run('DELETE FROM activity_daily WHERE date >= ?', [from]);
        await db.run('DELETE FROM sleep_session WHERE wake_date >= ?', [from]);
        await db.run('DELETE FROM heart_rate_daily WHERE date >= ?', [from]);
        await db.run('DELETE FROM watch_body_fat');
        // legacy_body_value rows cascade with their reading.
        await db.run('DELETE FROM scale_reading WHERE source = ?', [HEALTH_CONNECT_SOURCE]);

        for (const day of payload.activity) {
          await db.run(
            `INSERT INTO activity_daily (date, steps, distance_m, active_kcal, total_kcal, synced_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [day.date, day.steps, day.distanceM, day.activeKcal, day.totalKcal, syncedAt],
          );
        }
        for (const s of payload.sleep) {
          await db.run(
            `INSERT INTO sleep_session (hc_id, start_at, end_at, wake_date, asleep_s, awake_s,
               light_s, deep_s, rem_s, has_stages, synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              s.hcId,
              s.startAt,
              s.endAt,
              s.wakeDate,
              s.asleepS,
              s.awakeS,
              s.lightS,
              s.deepS,
              s.remS,
              s.hasStages ? 1 : 0,
              syncedAt,
            ],
          );
        }
        for (const h of payload.heartRate) {
          await db.run(
            `INSERT INTO heart_rate_daily (date, min_bpm, avg_bpm, max_bpm, synced_at)
             VALUES (?, ?, ?, ?, ?)`,
            [h.date, h.minBpm, h.avgBpm, h.maxBpm, syncedAt],
          );
        }
        for (const f of payload.watchBodyFat) {
          await db.run(
            'INSERT INTO watch_body_fat (hc_id, measured_at, body_fat_pct, origin) VALUES (?, ?, ?, ?)',
            [f.hcId, f.measuredAt, f.bodyFatPct, f.origin],
          );
        }
        for (const w of payload.weighIns) {
          const { lastInsertRowId } = await db.run(
            `INSERT INTO scale_reading (measured_at, weight_kg, source, source_record_id, raw_payload)
             VALUES (?, ?, ?, ?, ?)`,
            [w.measuredAt, w.weightKg, HEALTH_CONNECT_SOURCE, w.sourceRecordId, w.rawPayload],
          );
          if (w.bodyFatPct !== null) {
            await db.run(
              `INSERT INTO legacy_body_value (reading_id, metric, value, origin)
               VALUES (?, 'body_fat_pct', ?, ?)`,
              [lastInsertRowId, w.bodyFatPct, LEGACY_ORIGIN],
            );
          }
        }
      });
    },

    async listActivityDays() {
      const rows = await db.all<{
        date: string;
        steps: number | null;
        distance_m: number | null;
        active_kcal: number | null;
        total_kcal: number | null;
      }>(
        'SELECT date, steps, distance_m, active_kcal, total_kcal FROM activity_daily ORDER BY date',
      );
      return rows.map((r) => ({
        date: r.date,
        steps: r.steps,
        distanceM: r.distance_m,
        activeKcal: r.active_kcal,
        totalKcal: r.total_kcal,
      }));
    },

    async listSleepSessions() {
      const rows = await db.all<{
        hc_id: string;
        start_at: string;
        end_at: string;
        wake_date: string;
        asleep_s: number;
        awake_s: number;
        light_s: number | null;
        deep_s: number | null;
        rem_s: number | null;
        has_stages: number;
      }>(
        `SELECT hc_id, start_at, end_at, wake_date, asleep_s, awake_s, light_s, deep_s, rem_s,
                has_stages
         FROM sleep_session ORDER BY end_at, hc_id`,
      );
      return rows.map((r) => ({
        hcId: r.hc_id,
        startAt: r.start_at,
        endAt: r.end_at,
        wakeDate: r.wake_date,
        asleepS: r.asleep_s,
        awakeS: r.awake_s,
        lightS: r.light_s,
        deepS: r.deep_s,
        remS: r.rem_s,
        hasStages: r.has_stages === 1,
      }));
    },

    async listHeartRateDays() {
      const rows = await db.all<{
        date: string;
        min_bpm: number;
        avg_bpm: number;
        max_bpm: number;
      }>('SELECT date, min_bpm, avg_bpm, max_bpm FROM heart_rate_daily ORDER BY date');
      return rows.map((r) => ({
        date: r.date,
        minBpm: r.min_bpm,
        avgBpm: r.avg_bpm,
        maxBpm: r.max_bpm,
      }));
    },

    async listWatchBodyFat() {
      const rows = await db.all<{
        hc_id: string;
        measured_at: string;
        body_fat_pct: number;
        origin: string;
      }>(
        'SELECT hc_id, measured_at, body_fat_pct, origin FROM watch_body_fat ORDER BY measured_at, hc_id',
      );
      return rows.map((r) => ({
        hcId: r.hc_id,
        measuredAt: r.measured_at,
        bodyFatPct: r.body_fat_pct,
        origin: r.origin,
      }));
    },

    async listScaleReadings() {
      const rows = await db.all<{
        id: number;
        measured_at: string;
        weight_kg: number;
        source: string;
        body_fat_pct: number | null;
      }>(
        `SELECT r.id, r.measured_at, r.weight_kg, r.source, v.value AS body_fat_pct
         FROM scale_reading r
         LEFT JOIN legacy_body_value v ON v.reading_id = r.id AND v.metric = 'body_fat_pct'
         ORDER BY r.measured_at, r.id`,
      );
      return rows.map((r) => ({
        id: r.id,
        measuredAt: r.measured_at,
        weightKg: r.weight_kg,
        source: r.source,
        bodyFatPct: r.body_fat_pct,
      }));
    },

    async counts() {
      return {
        activityDays: await count('SELECT COUNT(*) AS n FROM activity_daily'),
        sleepSessions: await count('SELECT COUNT(*) AS n FROM sleep_session'),
        heartRateDays: await count('SELECT COUNT(*) AS n FROM heart_rate_daily'),
        watchBodyFat: await count('SELECT COUNT(*) AS n FROM watch_body_fat'),
        weighIns: await count(
          `SELECT COUNT(*) AS n FROM scale_reading WHERE source = '${HEALTH_CONNECT_SOURCE}'`,
        ),
      };
    },
  };
}
