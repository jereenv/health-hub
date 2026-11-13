import type { ActivityDay } from '@/data/healthconnect/HealthConnectRepository';
import { addDays } from '@/domain/time/localDate';

import { ACTIVITY_SPAN, buildActivitySeries, spanStart } from './activitySeries';

const TODAY = '2026-11-12'; // a Thursday; its week starts Monday 2026-11-09

function day(date: string, steps: number | null, rest: Partial<ActivityDay> = {}): ActivityDay {
  return { date, steps, distanceM: null, activeKcal: null, totalKcal: null, ...rest };
}

test('day range has 30 points ending today with gaps zero-filled', () => {
  const series = buildActivitySeries(
    [day('2026-11-12', 500), day('2026-11-10', 1000)],
    'steps',
    'day',
    TODAY,
  );
  expect(series.points).toHaveLength(ACTIVITY_SPAN.day);
  expect(series.points[0]!.start).toBe('2026-10-14');
  expect(series.points[29]).toEqual({ start: TODAY, value: 500, count: 1 });
  expect(series.points[28]).toEqual({ start: '2026-11-11', value: 0, count: 0 });
  expect(series.points[27]).toEqual({ start: '2026-11-10', value: 1000, count: 1 });
});

test('week and month points average completed days only and exclude today', () => {
  const days = [
    day('2026-11-09', 1000),
    day('2026-11-10', 3000),
    day('2026-11-12', 90000),
    day('2026-10-05', 2000),
    day('2026-10-20', 4000),
  ];
  const week = buildActivitySeries(days, 'steps', 'week', TODAY);
  expect(week.points).toHaveLength(ACTIVITY_SPAN.week);
  expect(week.points[11]).toEqual({ start: '2026-11-09', value: 2000, count: 2 });
  expect(week.points[0]!.start).toBe('2026-08-24');

  const month = buildActivitySeries(days, 'steps', 'month', TODAY);
  expect(month.points).toHaveLength(ACTIVITY_SPAN.month);
  expect(month.points[11]).toEqual({ start: '2026-11-01', value: 2000, count: 2 });
  expect(month.points[10]).toEqual({ start: '2026-10-01', value: 3000, count: 2 });
  expect(month.points[0]!.start).toBe('2025-12-01');
});

test('a partial current week is not lowered by today', () => {
  const withToday = buildActivitySeries(
    [day('2026-11-09', 8000), day('2026-11-10', 8000), day('2026-11-12', 100)],
    'steps',
    'week',
    TODAY,
  );
  expect(withToday.points[11]!.value).toBe(8000);
  expect(withToday.today).toBe(100);
});

test('a week or month bucket with no completed days is absent, never zero', () => {
  // Monday: the current week holds only today. The 1st: the current month holds only today.
  for (const [range, today, last] of [
    ['week', '2026-11-09', '2026-11-02'],
    ['month', '2026-11-01', '2026-10-01'],
  ] as const) {
    const series = buildActivitySeries(
      [day(today, 100), day('2026-10-05', 700)],
      'steps',
      range,
      today,
    );
    expect(series.points[series.points.length - 1]!.start).toBe(last);
    expect(series.points.some((p) => p.start === today)).toBe(false);
    expect(series.today).toBe(100);
    expect(series.averagePerDay).toBe(700);
  }
});

test('averagePerDay and bestDay ignore today and null values', () => {
  const series = buildActivitySeries(
    [
      day('2026-11-08', 4000),
      day('2026-11-09', 8000),
      day('2026-11-10', null),
      day('2026-11-12', 99999),
    ],
    'steps',
    'day',
    TODAY,
  );
  expect(series.averagePerDay).toBe(6000);
  expect(series.bestDay).toEqual({ date: '2026-11-09', value: 8000 });
});

test('averages and totals skip null days instead of counting them as zero', () => {
  const days = [
    day('2026-11-08', null, { distanceM: 3000 }),
    day('2026-11-09', null, { distanceM: null }),
    day('2026-11-10', null, { distanceM: 5000 }),
    day('2026-11-11', null, { distanceM: null }),
  ];
  const series = buildActivitySeries(days, 'distanceM', 'day', TODAY);
  expect(series.averagePerDay).toBe(4000);
  const week = buildActivitySeries(days, 'distanceM', 'week', TODAY);
  expect(week.points[11]!.count).toBe(1);
  expect(week.points[11]!.value).toBe(5000);
});

test('a range with no data has no average, best day or today, and stays finite', () => {
  const noRows = buildActivitySeries([], 'steps', 'day', TODAY);
  const allNull = buildActivitySeries(
    [day('2026-11-10', null), day(TODAY, null)],
    'steps',
    'week',
    TODAY,
  );
  for (const series of [noRows, allNull]) {
    expect(series.today).toBeNull();
    expect(series.averagePerDay).toBeNull();
    expect(series.bestDay).toBeNull();
    expect(series.points.every((p) => Number.isFinite(p.value) && p.count === 0)).toBe(true);
  }
  expect(noRows.points).toHaveLength(30);
});

test('active calories that are always null give an empty series', () => {
  const series = buildActivitySeries(
    [day('2026-11-10', 5, { totalKcal: 2000 })],
    'activeKcal',
    'day',
    TODAY,
  );
  expect(series.averagePerDay).toBeNull();
  expect(series.points.every((p) => p.count === 0)).toBe(true);
});

test('days outside the visible span are ignored', () => {
  const series = buildActivitySeries(
    [day('2025-01-01', 9999), day('2026-11-10', 1000)],
    'steps',
    'day',
    TODAY,
  );
  expect(series.averagePerDay).toBe(1000);
  expect(series.bestDay).toEqual({ date: '2026-11-10', value: 1000 });
});

test('a day that spans the DST change is one bucket', () => {
  const days = [day('2026-10-31', 1000), day('2026-11-01', 3000), day('2026-11-02', 5000)];
  const dayRange = buildActivitySeries(days, 'steps', 'day', '2026-11-03');
  expect(dayRange.points.filter((p) => p.start === '2026-11-01')).toEqual([
    { start: '2026-11-01', value: 3000, count: 1 },
  ]);
  expect(dayRange.points).toHaveLength(30);
  const weekRange = buildActivitySeries(days, 'steps', 'week', '2026-11-03');
  expect(weekRange.points[10]).toEqual({ start: '2026-10-26', value: 2000, count: 2 });
  expect(weekRange.points[11]).toEqual({ start: '2026-11-02', value: 5000, count: 1 });
});

test('spanStart steps back whole buckets', () => {
  expect(spanStart('day', TODAY)).toBe(addDays(TODAY, -29));
  expect(spanStart('week', TODAY)).toBe('2026-08-24');
  expect(spanStart('month', '2026-01-15')).toBe('2025-02-01');
});
