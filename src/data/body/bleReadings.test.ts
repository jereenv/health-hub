import { createSqliteHealthConnectRepository } from '@/data/healthconnect/HealthConnectRepository';
import { openTestDatabase } from '@/test-support/sqljsDatabase';

import { createSqliteBodyRepository } from './BodyRepository';
import { createSqliteBleReadingRepository, type BleReadingInput } from './bleReadings';

const AT = '2026-11-13T12:00:00.000Z';
const at = (offsetSeconds: number) => new Date(Date.parse(AT) + offsetSeconds * 1000).toISOString();

function reading(overrides: Partial<BleReadingInput> = {}): BleReadingInput {
  return {
    measuredAt: AT,
    weightKg: 80,
    impedanceOhm: 500,
    rawPayload: 'aabbcc',
    deviceId: 'dev-1',
    ...overrides,
  };
}

async function setup() {
  const db = await openTestDatabase();
  return {
    db,
    ble: createSqliteBleReadingRepository(db),
    body: createSqliteBodyRepository(db),
    healthConnect: createSqliteHealthConnectRepository(db),
  };
}

test('stores source ble with impedance and raw payload', async () => {
  const { ble, body, db } = await setup();
  expect(await ble.saveReading(reading())).toBe('saved');
  expect(await body.listReadings()).toEqual([
    expect.objectContaining({ source: 'ble', impedanceOhm: 500, weightKg: 80, measuredAt: AT }),
  ]);
  const row = await db.first<{ raw_payload: string; device_id: string; source_record_id: string }>(
    'SELECT raw_payload, device_id, source_record_id FROM scale_reading',
  );
  expect(row).toEqual({
    raw_payload: 'aabbcc',
    device_id: 'dev-1',
    source_record_id: `aabbcc@${AT}`,
  });
});

test('null impedance stays null', async () => {
  const { ble, body } = await setup();
  await ble.saveReading(reading({ impedanceOhm: null }));
  expect((await body.listReadings())[0]?.impedanceOhm).toBeNull();
});

test('the same weigh-in 3 s later is a duplicate and writes nothing', async () => {
  const { ble, body } = await setup();
  await ble.saveReading(reading());
  expect(await ble.saveReading(reading({ measuredAt: at(3), rawPayload: 'ddeeff' }))).toBe(
    'duplicate',
  );
  expect(await body.listReadings()).toHaveLength(1);
});

test('a different weight within the window is saved', async () => {
  const { ble, body } = await setup();
  await ble.saveReading(reading({ weightKg: 80 }));
  expect(
    await ble.saveReading(reading({ measuredAt: at(30), weightKg: 82, rawPayload: '01' })),
  ).toBe('saved');
  expect(await body.listReadings()).toHaveLength(2);
});

test('a health_connect reading of the same weigh-in makes the BLE save a duplicate', async () => {
  const { ble, body, healthConnect } = await setup();
  await healthConnect.applyImport({
    from: '2026-11-01',
    activity: [],
    sleep: [],
    heartRate: [],
    watchBodyFat: [],
    weighIns: [
      {
        measuredAt: at(-40),
        weightKg: 80.05,
        sourceRecordId: 'w1',
        rawPayload: '{}',
        bodyFatPct: null,
      },
    ],
    syncedAt: AT,
  });
  expect(await ble.saveReading(reading())).toBe('duplicate');
  expect((await body.listReadings()).map((r) => r.source)).toEqual(['health_connect']);
});

test('a reading 3 minutes apart is saved', async () => {
  const { ble, body } = await setup();
  await ble.saveReading(reading());
  expect(await ble.saveReading(reading({ measuredAt: at(180), rawPayload: '02' }))).toBe('saved');
  expect(await body.listReadings()).toHaveLength(2);
});

test('save rolls back and rejects when the insert fails', async () => {
  const { ble, body, db } = await setup();
  // Same source_record_id, but a reading far outside the window, so it is not a duplicate.
  await db.run(
    `INSERT INTO scale_reading (measured_at, weight_kg, source, source_record_id)
     VALUES ('2026-01-01T00:00:00.000Z', 70, 'ble', ?)`,
    [`aabbcc@${AT}`],
  );
  await expect(ble.saveReading(reading())).rejects.toThrow();
  expect(await body.listReadings()).toHaveLength(1);
});
