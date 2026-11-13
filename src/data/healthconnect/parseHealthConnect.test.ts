import {
  parseBodyRecords,
  parseDailyHeartRate,
  parseDailyValues,
  parseSleepRecords,
} from './parseHealthConnect';

const steps = require('./__fixtures__/steps-groups.json');
const heartRate = require('./__fixtures__/heart-rate-groups.json');
const sleep = require('./__fixtures__/sleep-records.json');
const body = require('./__fixtures__/body-records.json');

const ORIGIN = ['com.sec.android.app.shealth'];

function group(result: Record<string, unknown>, startTime = '2026-11-10T00:00') {
  return { result: { dataOrigins: ORIGIN, ...result }, startTime, endTime: '2026-11-11T00:00' };
}

test('steps parse to a rounded integer per local day from the zoneless startTime', () => {
  const parsed = parseDailyValues('steps', steps);
  expect(parsed.items).toEqual([
    { date: '2026-11-10', value: 1234 },
    { date: '2026-11-11', value: 0 },
    { date: '2026-11-13', value: 7 },
  ]);
});

test('a group with empty dataOrigins yields no item and is not rejected', () => {
  expect(
    parseDailyValues('steps', [{ result: { dataOrigins: [] }, startTime: '2026-11-12T00:00' }]),
  ).toEqual({
    items: [],
    rejected: 0,
  });
  expect(
    parseDailyValues('steps', [{ result: { COUNT_TOTAL: 5 }, startTime: '2026-11-12T00:00' }]),
  ).toEqual({
    items: [],
    rejected: 0,
  });
});

test('a group with origins and a zero total keeps the zero', () => {
  expect(parseDailyValues('steps', [group({ COUNT_TOTAL: 0 })]).items).toEqual([
    { date: '2026-11-10', value: 0 },
  ]);
});

test('a negative, NaN or non-numeric total is rejected and counted', () => {
  const parsed = parseDailyValues('steps', [
    group({ COUNT_TOTAL: -1 }),
    group({ COUNT_TOTAL: Number.NaN }),
    group({ COUNT_TOTAL: '12' }),
    group({}),
    group({ COUNT_TOTAL: 3 }, 'not-a-day'),
    null,
    group({ COUNT_TOTAL: 4 }),
  ]);
  expect(parsed.items).toEqual([{ date: '2026-11-10', value: 4 }]);
  expect(parsed.rejected).toBe(6);
});

test('distance reads inMeters and calories read inKilocalories', () => {
  expect(
    parseDailyValues('distanceM', [group({ DISTANCE: { inMeters: 5200.5, inMiles: 3.2 } })]).items,
  ).toEqual([{ date: '2026-11-10', value: 5200.5 }]);
  expect(
    parseDailyValues('totalKcal', [
      group({ ENERGY_TOTAL: { inKilocalories: 2100.5, inCalories: 2100500 } }),
    ]).items,
  ).toEqual([{ date: '2026-11-10', value: 2100.5 }]);
  expect(
    parseDailyValues('activeKcal', [group({ ACTIVE_CALORIES_TOTAL: { inKilocalories: 300 } })])
      .items,
  ).toEqual([{ date: '2026-11-10', value: 300 }]);
  // Each kind reads only its own field.
  expect(
    parseDailyValues('activeKcal', [group({ ENERGY_TOTAL: { inKilocalories: 1 } })]).rejected,
  ).toBe(1);
});

test('heart rate groups keep min, avg and max and drop groups without measurements', () => {
  const parsed = parseDailyHeartRate(heartRate);
  expect(parsed.items).toEqual([{ date: '2026-11-10', minBpm: 48, avgBpm: 71.3, maxBpm: 152 }]);
  // The empty-origins group is no data; the group with origins but no figures is rejected.
  expect(parsed.rejected).toBe(1);
});

test('sleep records keep stages, map unknown stage numbers to unknown, and drop a record without an id', () => {
  const parsed = parseSleepRecords(sleep);
  expect(parsed.rejected).toBe(1);
  expect(parsed.items.map((r) => r.hcId)).toEqual(['sleep-1', 'sleep-2']);
  expect(parsed.items[0]!.stages.map((s) => s.stage)).toEqual([
    'awake',
    'light',
    'deep',
    'unknown',
  ]);
  expect(parsed.items[0]!.startAt).toBe('2026-11-12T03:30:00.000Z');
  expect(parsed.items[1]!.stages).toEqual([]);
});

test('body records read kg and percent, default a missing origin to empty, and reject non-finite values', () => {
  const weights = parseBodyRecords('weight', body.weight);
  expect(weights.items).toEqual([
    { hcId: 'w-1', time: '2026-11-12T12:00:00.000Z', origin: 'com.moving.movinglife', value: 80.4 },
    { hcId: 'w-2', time: '2026-11-12T13:00:00.000Z', origin: '', value: 80.2 },
  ]);
  expect(weights.rejected).toBe(2);
  const fat = parseBodyRecords('bodyFat', body.bodyFat);
  expect(fat.items).toEqual([
    { hcId: 'f-1', time: '2026-11-12T12:01:00.000Z', origin: 'com.moving.movinglife', value: 18.5 },
  ]);
  expect(fat.rejected).toBe(1);
});

test('every parser returns empty results for null, a string, an object and an empty array', () => {
  for (const input of [null, undefined, 'text', 5, {}, { records: [] }, []]) {
    const empty = { items: [], rejected: 0 };
    expect(parseDailyValues('steps', input)).toEqual(empty);
    expect(parseDailyHeartRate(input)).toEqual(empty);
    expect(parseSleepRecords(input)).toEqual(empty);
    expect(parseBodyRecords('weight', input)).toEqual(empty);
    expect(parseBodyRecords('bodyFat', input)).toEqual(empty);
  }
});
