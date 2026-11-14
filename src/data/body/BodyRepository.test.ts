import type { SqlDatabase } from '@/data/db/SqlDatabase';
import { openTestDatabase } from '@/test-support/sqljsDatabase';

import { createSqliteBodyRepository } from './BodyRepository';

async function addReading(
  db: SqlDatabase,
  at: string,
  weightKg: number,
  source: string,
  impedanceOhm: number | null,
  recordId: string,
): Promise<number> {
  const result = await db.run(
    `INSERT INTO scale_reading (measured_at, weight_kg, impedance_ohm, source, source_record_id)
     VALUES (?, ?, ?, ?, ?)`,
    [at, weightKg, impedanceOhm, source, recordId],
  );
  return result.lastInsertRowId;
}

async function addLegacy(db: SqlDatabase, id: number, metric: string, value: number) {
  await db.run(
    `INSERT INTO legacy_body_value (reading_id, metric, value, origin) VALUES (?, ?, ?, 'movinglife')`,
    [id, metric, value],
  );
}

test('listReadings returns health_connect and ble readings ascending with impedance', async () => {
  const db = await openTestDatabase();
  await addReading(db, '2026-11-02T12:00:00.000Z', 80.2, 'ble', 500, 'b1');
  await addReading(db, '2026-11-01T12:00:00.000Z', 80.5, 'health_connect', null, 'h1');
  const readings = await createSqliteBodyRepository(db).listReadings();
  expect(readings.map((r) => [r.measuredAt, r.weightKg, r.impedanceOhm, r.source])).toEqual([
    ['2026-11-01T12:00:00.000Z', 80.5, null, 'health_connect'],
    ['2026-11-02T12:00:00.000Z', 80.2, 500, 'ble'],
  ]);
});

test('readings at the same instant keep id order', async () => {
  const db = await openTestDatabase();
  const first = await addReading(db, '2026-11-01T12:00:00.000Z', 80, 'ble', null, 'a');
  const second = await addReading(db, '2026-11-01T12:00:00.000Z', 81, 'ble', null, 'b');
  const readings = await createSqliteBodyRepository(db).listReadings();
  expect(readings.map((r) => r.id)).toEqual([first, second]);
});

test('body fat comes from legacy_body_value metric body_fat_pct and is null when absent', async () => {
  const db = await openTestDatabase();
  const withFat = await addReading(db, '2026-11-01T12:00:00.000Z', 80, 'health_connect', null, 'a');
  await addReading(db, '2026-11-02T12:00:00.000Z', 80, 'health_connect', null, 'b');
  await addLegacy(db, withFat, 'body_fat_pct', 18.5);
  const readings = await createSqliteBodyRepository(db).listReadings();
  expect(readings.map((r) => r.legacyBodyFatPct)).toEqual([18.5, null]);
});

test('another legacy metric is not read as body fat', async () => {
  const db = await openTestDatabase();
  const id = await addReading(db, '2026-11-01T12:00:00.000Z', 80, 'health_connect', null, 'a');
  await addLegacy(db, id, 'lean_mass_kg', 64);
  const [reading] = await createSqliteBodyRepository(db).listReadings();
  expect(reading?.legacyBodyFatPct).toBeNull();
});
