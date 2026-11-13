import type { HeartRateDay } from '@/data/healthconnect/HealthConnectRepository';

import { buildHeartRateSummary } from './heartRate';

const TODAY = '2026-11-12';

function hr(date: string, minBpm: number, avgBpm: number, maxBpm: number): HeartRateDay {
  return { date, minBpm, avgBpm, maxBpm };
}

test('lowest, highest and average come from the visible span only', () => {
  const summary = buildHeartRateSummary(
    [
      hr('2026-01-01', 30, 50, 200), // far outside the 30 day span
      hr('2026-11-01', 52, 70, 150),
      hr('2026-11-11', 48, 80, 170),
    ],
    'day',
    TODAY,
  );
  expect(summary.lowest).toBe(48);
  expect(summary.highest).toBe(170);
  expect(summary.average).toBe(75);
  expect(summary.points).toEqual([
    { start: '2026-11-01', value: 70, count: 1 },
    { start: '2026-11-11', value: 80, count: 1 },
  ]);
});

test('week and month points are the mean of the daily averages', () => {
  const days = [hr('2026-11-09', 50, 60, 100), hr('2026-11-10', 50, 70, 100)];
  expect(buildHeartRateSummary(days, 'week', TODAY).points).toEqual([
    { start: '2026-11-09', value: 65, count: 2 },
  ]);
  expect(buildHeartRateSummary(days, 'month', TODAY).points).toEqual([
    { start: '2026-11-01', value: 65, count: 2 },
  ]);
});

test('empty buckets are absent, not zero', () => {
  const summary = buildHeartRateSummary([hr('2026-11-12', 50, 60, 100)], 'day', TODAY);
  expect(summary.points).toHaveLength(1);
});

test('no data in the span gives null figures and no points', () => {
  expect(buildHeartRateSummary([], 'week', TODAY)).toEqual({
    points: [],
    lowest: null,
    average: null,
    highest: null,
  });
  expect(buildHeartRateSummary([hr('2020-01-01', 50, 60, 100)], 'week', TODAY).average).toBeNull();
});
