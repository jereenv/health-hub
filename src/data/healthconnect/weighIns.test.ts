import { MOVINGLIFE_ORIGIN, SAMSUNG_HEALTH_ORIGIN } from './constants';
import type { BodyRecord } from './HealthConnectGateway';
import { buildWeighIns } from './weighIns';

const BASE = Date.parse('2026-11-12T12:00:00.000Z');

function record(
  id: string,
  offsetSeconds: number,
  value: number,
  origin = MOVINGLIFE_ORIGIN,
): BodyRecord {
  return { hcId: id, time: new Date(BASE + offsetSeconds * 1000).toISOString(), origin, value };
}

test('a MovingLife weight with body fat 2 minutes later becomes one weigh-in with that body fat', () => {
  const result = buildWeighIns([record('w', 0, 80)], [record('f', 120, 18.5)]);
  expect(result.weighIns).toEqual([
    {
      measuredAt: '2026-11-12T12:00:00.000Z',
      weightKg: 80,
      sourceRecordId: 'w',
      rawPayload: '{"weightRecordIds":["w"],"bodyFatRecordId":"f"}',
      bodyFatPct: 18.5,
    },
  ]);
  expect(result.orphanBodyFat).toBe(0);
});

test('two MovingLife weights 90 s and 0.05 kg apart collapse to the first', () => {
  const result = buildWeighIns([record('b', 90, 80.05), record('a', 0, 80)], [], 'time_window');
  expect(result.weighIns).toHaveLength(1);
  expect(result.weighIns[0]).toMatchObject({ sourceRecordId: 'a', weightKg: 80 });
  expect(result.weighIns[0]!.rawPayload).toBe(
    '{"weightRecordIds":["a","b"],"bodyFatRecordId":null}',
  );
});

test('two weights 3 minutes apart stay separate under time_window', () => {
  const result = buildWeighIns([record('a', 0, 80), record('b', 180, 80)], [], 'time_window');
  expect(result.weighIns).toHaveLength(2);
});

test('two weights hours apart on one day with the same weight collapse under same_day', () => {
  const weights = [record('a', 0, 80), record('b', 3 * 3600, 80)];
  expect(buildWeighIns(weights, [], 'same_day').weighIns).toHaveLength(1);
  expect(buildWeighIns(weights, [], 'time_window').weighIns).toHaveLength(2);
});

test('a 0.2 kg difference keeps two weigh-ins under both rules', () => {
  const weights = [record('a', 0, 80), record('b', 30, 80.2)];
  expect(buildWeighIns(weights, [], 'time_window').weighIns).toHaveLength(2);
  expect(buildWeighIns(weights, [], 'same_day').weighIns).toHaveLength(2);
});

test('grouping compares with the first record of the group, not a chain', () => {
  const weights = [record('a', 0, 80), record('b', 90, 80), record('c', 180, 80)];
  const result = buildWeighIns(weights, [], 'time_window');
  expect(result.weighIns.map((w) => w.sourceRecordId)).toEqual(['a', 'c']);
});

test('Samsung body fat becomes watch body fat and never touches a weigh-in', () => {
  const result = buildWeighIns([record('w', 0, 80)], [record('f', 10, 22, SAMSUNG_HEALTH_ORIGIN)]);
  expect(result.watchBodyFat).toEqual([
    {
      hcId: 'f',
      measuredAt: '2026-11-12T12:00:10.000Z',
      bodyFatPct: 22,
      origin: SAMSUNG_HEALTH_ORIGIN,
    },
  ]);
  expect(result.weighIns[0]!.bodyFatPct).toBeNull();
  expect(result.orphanBodyFat).toBe(0);
});

test('Samsung weight and unknown-origin weight are ignored and counted', () => {
  const result = buildWeighIns(
    [
      record('s', 0, 80, SAMSUNG_HEALTH_ORIGIN),
      record('u', 10, 80, ''),
      record('x', 20, 80, 'com.other'),
    ],
    [record('o', 0, 20, 'com.other')],
  );
  expect(result.weighIns).toEqual([]);
  expect(result.ignored).toBe(4);
});

test('an orphan MovingLife body fat is counted and dropped', () => {
  const result = buildWeighIns([record('w', 0, 80)], [record('f', 600, 18)], 'time_window');
  expect(result.orphanBodyFat).toBe(1);
  expect(result.weighIns[0]!.bodyFatPct).toBeNull();
});

test('same_day attaches body fat from hours later on the same local day', () => {
  const result = buildWeighIns([record('w', 0, 80)], [record('f', 3 * 3600, 18)], 'same_day');
  expect(result.weighIns[0]!.bodyFatPct).toBe(18);
});

test('the nearest weigh-in gets the body fat and the earliest body fat wins', () => {
  const weights = [record('a', 0, 80), record('b', 300, 85)];
  const fat = [record('f2', 290, 19), record('f1', 280, 18)];
  const result = buildWeighIns(weights, fat, 'time_window');
  // f1 and f2 are both within 2 minutes of b only; b takes the earlier f1, f2 is not an orphan.
  expect(result.weighIns.map((w) => w.bodyFatPct)).toEqual([null, 18]);
  expect(result.orphanBodyFat).toBe(0);
});

test('implausible weights and percentages are dropped and counted', () => {
  const result = buildWeighIns(
    [record('a', 0, 19.9), record('b', 600, 400.1), record('c', 1200, 20), record('d', 1800, 400)],
    [record('f', 0, 0), record('g', 0, 100), record('h', 0, 50, SAMSUNG_HEALTH_ORIGIN)],
  );
  expect(result.implausible).toBe(4);
  expect(result.weighIns.map((w) => w.sourceRecordId)).toEqual(['c', 'd']);
  expect(result.watchBodyFat).toHaveLength(1);
});

test('output is deterministic when records arrive unsorted', () => {
  const weights = [record('c', 600, 81), record('a', 0, 80), record('b', 60, 80.05)];
  const fat = [record('g', 605, 20), record('f', 5, 18)];
  const forward = buildWeighIns(weights, fat);
  const backward = buildWeighIns([...weights].reverse(), [...fat].reverse());
  expect(backward).toEqual(forward);
  expect(forward.weighIns.map((w) => w.sourceRecordId)).toEqual(['a', 'c']);
});
