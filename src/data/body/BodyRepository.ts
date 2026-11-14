import type { SqlDatabase } from '@/data/db/SqlDatabase';

export interface BodyReading {
  id: number;
  /** ISO-8601 UTC instant. */
  measuredAt: string;
  weightKg: number;
  /** Null for weight-only readings (Health Connect). */
  impedanceOhm: number | null;
  /** 'health_connect' or 'ble'. */
  source: string;
  /** MovingLife's own body fat, imported from history; null when the reading has none. */
  legacyBodyFatPct: number | null;
}

export interface BodyRepository {
  /** Ascending by measured_at then id. */
  listReadings(): Promise<BodyReading[]>;
}

interface ReadingRow {
  id: number;
  measured_at: string;
  weight_kg: number;
  impedance_ohm: number | null;
  source: string;
  body_fat_pct: number | null;
}

export function createSqliteBodyRepository(db: SqlDatabase): BodyRepository {
  return {
    async listReadings() {
      const rows = await db.all<ReadingRow>(
        `SELECT r.id, r.measured_at, r.weight_kg, r.impedance_ohm, r.source, v.value AS body_fat_pct
         FROM scale_reading r
         LEFT JOIN legacy_body_value v ON v.reading_id = r.id AND v.metric = 'body_fat_pct'
         ORDER BY r.measured_at, r.id`,
      );
      return rows.map((row) => ({
        id: row.id,
        measuredAt: row.measured_at,
        weightKg: row.weight_kg,
        impedanceOhm: row.impedance_ohm,
        source: row.source,
        legacyBodyFatPct: row.body_fat_pct,
      }));
    },
  };
}
