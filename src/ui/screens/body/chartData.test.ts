import type { MetricSeries, SlotPoint } from '@/domain/body/series';

import { legendEntries, toBodyChartData } from './chartData';

function series(slots: SlotPoint[]): MetricSeries {
  return { slots, average7: null, stats: null, current: null, mixed: false };
}

const slot = (start: string, value: number | null, hollow = false): SlotPoint => ({
  start,
  value,
  hollow,
  count: value === null ? 0 : 1,
});

test('hollow and breakBefore come from the slots, breakBefore only where the method changes', () => {
  const data = toBodyChartData(
    series([
      slot('2026-11-09', 80, true),
      slot('2026-11-10', null),
      slot('2026-11-11', 79, true),
      slot('2026-11-12', 78, false),
      slot('2026-11-13', 77, false),
    ]),
    'day',
    '2026-11-13',
  );
  expect(data.map((d) => d.hollow)).toEqual([true, undefined, true, false, false]);
  expect(data.map((d) => d.breakBefore)).toEqual([false, undefined, false, true, false]);
});

test('day tooltips read like "Wed 11 Nov", week "Week of 9 Nov", month "November 2026"', () => {
  const day = toBodyChartData(series([slot('2026-11-11', 80)]), 'day', '2026-11-13');
  const week = toBodyChartData(series([slot('2026-11-09', 80)]), 'week', '2026-11-13');
  const month = toBodyChartData(series([slot('2026-11-01', 80)]), 'month', '2026-11-13');
  expect(day[0]!.tooltipLabel).toBe('Wed 11 Nov');
  expect(week[0]!.tooltipLabel).toBe('Week of 9 Nov');
  expect(month[0]!.tooltipLabel).toBe('November 2026');
  expect([day[0]!.axisLabel, week[0]!.axisLabel, month[0]!.axisLabel]).toEqual([
    '11 Nov',
    '9 Nov',
    'Nov 26',
  ]);
});

test('the last day slot is labelled Today on the axis', () => {
  const data = toBodyChartData(series([slot('2026-11-13', null)]), 'day', '2026-11-13');
  expect(data[0]!.axisLabel).toBe('Today');
});

test('null slots keep their key and axis label but carry value null', () => {
  const data = toBodyChartData(
    series([slot('2026-11-11', 80), slot('2026-11-12', null)]),
    'day',
    '2026-11-13',
  );
  expect(data[1]).toMatchObject({ key: '2026-11-12', axisLabel: '12 Nov', value: null });
});

test('the legend names the methods of the visible points: MovingLife hollow, everything else Scale', () => {
  expect(legendEntries(series([slot('2026-11-12', 80, true), slot('2026-11-13', null)]))).toEqual([
    { label: 'MovingLife', hollow: true },
  ]);
  expect(legendEntries(series([slot('2026-11-12', 80, false)]))).toEqual([
    { label: 'Scale', hollow: false },
  ]);
  expect(
    legendEntries(series([slot('2026-11-11', 80, true), slot('2026-11-12', 79, false)])),
  ).toEqual([
    { label: 'Scale', hollow: false },
    { label: 'MovingLife', hollow: true },
  ]);
  expect(legendEntries(series([slot('2026-11-12', null)]))).toEqual([]);
});

test('month axis labels carry the two-digit year', () => {
  const data = toBodyChartData(
    series([slot('2024-12-01', 80), slot('2025-11-01', 79), slot('2026-11-01', 78)]),
    'month',
    '2026-11-13',
  );
  expect(data.map((d) => d.axisLabel)).toEqual(['Dec 24', 'Nov 25', 'Nov 26']);
});
