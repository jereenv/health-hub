import type { SqlDatabase } from '@/data/db/SqlDatabase';
import { WEIGH_IN_MATCH, WEIGH_IN_WINDOW_MS } from '@/data/healthconnect/constants';

import { isSameWeighIn } from './weighInMatch';

const BLE_SOURCE = 'ble';
/** Candidates are read slightly wider than the match window; `isSameWeighIn` makes the real decision. */
const TIME_WINDOW_SLACK_MS = 1_000;
const SAME_DAY_SPAN_MS = 36 * 60 * 60 * 1_000;

/** One fresh weigh-in from the Bluetooth scale, ready to store. */
export interface BleReadingInput {
  measuredAt: string;
  weightKg: number;
  impedanceOhm: number | null;
  rawPayload: string;
  deviceId: string;
}

export interface BleReadingRepository {
  /** `'duplicate'` when any stored reading, of any source, is the same weigh-in; nothing is written then. */
  saveReading(reading: BleReadingInput): Promise<'saved' | 'duplicate'>;
}

interface CandidateRow {
  measured_at: string;
  weight_kg: number;
}

export function createSqliteBleReadingRepository(db: SqlDatabase): BleReadingRepository {
  return {
    async saveReading(reading) {
      const centre = new Date(reading.measuredAt).getTime();
      const span =
        WEIGH_IN_MATCH === 'time_window'
          ? WEIGH_IN_WINDOW_MS + TIME_WINDOW_SLACK_MS
          : SAME_DAY_SPAN_MS;
      const from = new Date(centre - span).toISOString();
      const to = new Date(centre + span).toISOString();

      // One transaction: transactions are not re-entrant, so no other repository call happens inside.
      return db.transaction(async () => {
        const candidates = await db.all<CandidateRow>(
          'SELECT measured_at, weight_kg FROM scale_reading WHERE measured_at BETWEEN ? AND ?',
          [from, to],
        );
        const duplicate = candidates.some((row) =>
          isSameWeighIn(
            { time: reading.measuredAt, weightKg: reading.weightKg },
            { time: row.measured_at, weightKg: row.weight_kg },
          ),
        );
        if (duplicate) return 'duplicate' as const;

        await db.run(
          `INSERT INTO scale_reading
             (measured_at, weight_kg, impedance_ohm, source, source_record_id, raw_payload, device_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            reading.measuredAt,
            reading.weightKg,
            reading.impedanceOhm,
            BLE_SOURCE,
            `${reading.rawPayload}@${reading.measuredAt}`,
            reading.rawPayload,
            reading.deviceId,
          ],
        );
        return 'saved' as const;
      });
    },
  };
}
