import type { WatchBodyFat } from '@/data/healthconnect/HealthConnectRepository';

import type { ReadingMetrics } from './readings';
import { BODY_SPAN, buildMetricSeries, change30, dayPoints, watchByDay } from './series';
import type { DayPoint } from './series';
import type { MetricId, Origin } from './types';

// 2026-11-13 is a Friday; its week starts Monday 2026-11-09.
const TODAY = '2026-11-13';

function point(date: string, value: number, origin: Origin = 'formula', readingId = 1): DayPoint {
  return { date, value, origin, readingId };
}

function reading(
  id: number,
  date: string,
  metric: MetricId,
  value: number | null,
  origin: Origin = 'formula',
): ReadingMetrics {
  return {
    id,
    measuredAt: `${date}T12:00:00.000Z`,
    date,
    metrics: value === null ? {} : { [metric]: { value, tier: 'estimated', origin } },
  };
}

test('dayPoints takes the first reading of the local day that has the metric', () => {
  const points = dayPoints(
    [
      reading(1, '2026-11-10', 'body_fat_pct', null),
      reading(2, '2026-11-10', 'body_fat_pct', 20),
      reading(3, '2026-11-10', 'body_fat_pct', 22),
      reading(4, '2026-11-11', 'body_fat_pct', 21),
    ],
    'body_fat_pct',
  );
  expect(points).toEqual([
    { date: '2026-11-10', value: 20, origin: 'formula', readingId: 2 },
    { date: '2026-11-11', value: 21, origin: 'formula', readingId: 4 },
  ]);
});

test('dayPoints skips days where the metric is absent', () => {
  expect(dayPoints([reading(1, '2026-11-10', 'body_fat_pct', null)], 'body_fat_pct')).toEqual([]);
});

test('day range has 30 slots ending today, with null for days without a reading', () => {
  const series = buildMetricSeries([point('2026-11-12', 80), point(TODAY, 79.5)], 'day', TODAY);
  expect(series.slots).toHaveLength(BODY_SPAN.day);
  expect(series.slots[0]?.start).toBe('2026-10-15');
  expect(series.slots[29]).toEqual({ start: TODAY, value: 79.5, hollow: false, count: 1 });
  expect(series.slots[27]).toEqual({ start: '2026-11-11', value: null, hollow: false, count: 0 });
});

test('week range has 26 Monday-start slots and month range 24 month-start slots', () => {
  const week = buildMetricSeries([], 'week', TODAY);
  expect(week.slots).toHaveLength(26);
  expect(week.slots[25]?.start).toBe('2026-11-09');
  expect(week.slots[24]?.start).toBe('2026-11-02');
  expect(week.slots[0]?.start).toBe('2026-05-18');
  const month = buildMetricSeries([], 'month', TODAY);
  expect(month.slots).toHaveLength(24);
  expect(month.slots[23]?.start).toBe('2026-11-01');
  expect(month.slots[22]?.start).toBe('2026-10-01');
  expect(month.slots[0]?.start).toBe('2024-12-01');
});

test('a week bucket averages its day points', () => {
  const series = buildMetricSeries(
    [point('2026-11-09', 80), point('2026-11-11', 79), point(TODAY, 78)],
    'week',
    TODAY,
  );
  expect(series.slots[25]).toEqual({ start: '2026-11-09', value: 79, hollow: false, count: 3 });
});

test('a bucket with solid and hollow points averages only the solid ones and is solid', () => {
  const series = buildMetricSeries(
    [point('2026-11-09', 30, 'movinglife'), point('2026-11-11', 20, 'formula'), point(TODAY, 22)],
    'week',
    TODAY,
  );
  expect(series.slots[25]).toEqual({ start: '2026-11-09', value: 21, hollow: false, count: 2 });
  const allHollow = buildMetricSeries(
    [point('2026-11-09', 30, 'movinglife'), point('2026-11-11', 20, 'movinglife_derived')],
    'month',
    TODAY,
  );
  expect(allHollow.slots[23]).toEqual({ start: '2026-11-01', value: 25, hollow: true, count: 2 });
});

test('average7 averages the previous 7 calendar days, same method only, and is null on empty slots', () => {
  const days = [
    point('2026-11-06', 100, 'movinglife'),
    point('2026-11-08', 10),
    point('2026-11-10', 20),
    point('2026-11-13', 30),
  ];
  const { slots, average7 } = buildMetricSeries(days, 'day', TODAY);
  if (!average7) throw new Error('expected average7');
  expect(average7).toHaveLength(slots.length);
  // 2026-11-13 looks back to 11-07: the points on 11-08, 11-10 and 11-13 count, 11-06 is out.
  expect(average7[29]).toBe(20);
  expect(average7[27]).toBeNull(); // 11-11 has no reading
  // The hollow point on 11-06 averages only with hollow neighbours, so just itself.
  expect(average7[22]).toBe(100);
  // 11-08 looks back to 11-02: the solid point only (the hollow 11-06 is another method).
  expect(average7[24]).toBe(10);
  // 11-10 looks back to 11-04: the solid points on 11-08 and 11-10.
  expect(average7[26]).toBe(15);
});

test('average7 is null for week and month', () => {
  expect(buildMetricSeries([point(TODAY, 1)], 'week', TODAY).average7).toBeNull();
  expect(buildMetricSeries([point(TODAY, 1)], 'month', TODAY).average7).toBeNull();
});

test('stats use only the latest method and the visible span; change is null with one point', () => {
  const days = [
    point('2026-09-01', 99), // outside the 30-day span
    point('2026-10-20', 30, 'movinglife'),
    point('2026-10-25', 24),
    point('2026-11-05', 22),
    point(TODAY, 20),
  ];
  const { stats } = buildMetricSeries(days, 'day', TODAY);
  expect(stats).toEqual({ average: 22, lowest: 20, highest: 24, change: -4 });
  const single = buildMetricSeries([point(TODAY, 20)], 'day', TODAY).stats;
  expect(single).toEqual({ average: 20, lowest: 20, highest: 20, change: null });
  expect(buildMetricSeries([], 'day', TODAY).stats).toBeNull();
});

test('mixed is true only when both methods appear in the visible span', () => {
  const both = [point('2026-10-20', 30, 'movinglife'), point(TODAY, 20)];
  expect(buildMetricSeries(both, 'day', TODAY).mixed).toBe(true);
  expect(buildMetricSeries([point(TODAY, 20)], 'day', TODAY).mixed).toBe(false);
  expect(buildMetricSeries([point('2026-10-20', 30, 'movinglife')], 'day', TODAY).mixed).toBe(
    false,
  );
  // The hollow point is outside the 30-day span, so the day view is not mixed.
  expect(
    buildMetricSeries([point('2026-08-20', 30, 'movinglife'), point(TODAY, 20)], 'day', TODAY)
      .mixed,
  ).toBe(false);
});

test('current is the latest point even when it is outside the visible span', () => {
  const series = buildMetricSeries(
    [point('2026-01-05', 85), point('2026-01-09', 84)],
    'day',
    TODAY,
  );
  expect(series.current).toEqual(point('2026-01-09', 84));
  expect(series.stats).toBeNull();
  expect(buildMetricSeries([], 'day', TODAY).current).toBeNull();
});

test('change30 needs two points at least 7 days apart and ignores the other method', () => {
  expect(change30([point('2026-11-10', 80), point(TODAY, 79)], TODAY)).toBeNull();
  expect(change30([point('2026-11-06', 80), point(TODAY, 79)], TODAY)).toBeCloseTo(-1, 6);
  expect(change30([point('2026-11-05', 80), point(TODAY, 79)], TODAY)).toBeCloseTo(-1, 6);
  const mixed = [point('2026-10-20', 30, 'movinglife'), point('2026-11-05', 24), point(TODAY, 22)];
  expect(change30(mixed, TODAY)).toBe(-2);
  // A point 30 days ago is outside the 30-day window (today - 29 is the first day).
  expect(change30([point('2026-10-14', 90), point(TODAY, 80)], TODAY)).toBeNull();
  expect(change30([], TODAY)).toBeNull();
});

test('watchByDay averages several checks on one day and aligns to the slots', () => {
  const checks: WatchBodyFat[] = [
    { hcId: 'a', measuredAt: '2026-11-13T09:00:00.000Z', bodyFatPct: 20, origin: 'watch' },
    { hcId: 'b', measuredAt: '2026-11-13T15:00:00.000Z', bodyFatPct: 22, origin: 'watch' },
    { hcId: 'c', measuredAt: '2026-11-11T15:00:00.000Z', bodyFatPct: 25, origin: 'watch' },
    { hcId: 'd', measuredAt: '2025-01-01T15:00:00.000Z', bodyFatPct: 30, origin: 'watch' },
  ];
  const { slots } = buildMetricSeries([], 'day', TODAY);
  const aligned = watchByDay(checks, slots);
  expect(aligned).toHaveLength(30);
  expect(aligned[29]).toBe(21);
  expect(aligned[28]).toBeNull();
  expect(aligned[27]).toBe(25);
  expect(aligned.filter((value) => value !== null)).toHaveLength(2);
});

test('empty input gives finite, empty results', () => {
  const series = buildMetricSeries([], 'day', TODAY);
  expect(series.slots.every((slot) => slot.value === null && slot.count === 0)).toBe(true);
  expect(series.average7?.every((value) => value === null)).toBe(true);
  expect(series.stats).toBeNull();
  expect(series.mixed).toBe(false);
  expect(watchByDay([], series.slots).every((value) => value === null)).toBe(true);
});
