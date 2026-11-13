import { toActivityChartData, withPerDaySuffix } from './chartData';

const POINT = { start: '2026-11-01', value: 5, count: 1 };

test('tooltip labels follow the range', () => {
  expect(
    toActivityChartData([{ ...POINT, start: '2026-11-09' }], 'day', '2026-11-12')[0]!.tooltipLabel,
  ).toBe('Mon 9 Nov');
  expect(
    toActivityChartData([{ ...POINT, start: '2026-11-09' }], 'week', '2026-11-12')[0]!.tooltipLabel,
  ).toBe('Week of 9 Nov');
  expect(toActivityChartData([POINT], 'month', '2026-11-12')[0]!.tooltipLabel).toBe('Nov 2026');
});

test('only week and month values say avg/day', () => {
  const format = (v: number): string => `${v} steps`;
  expect(withPerDaySuffix(format, 'day')(3)).toBe('3 steps');
  expect(withPerDaySuffix(format, 'week')(3)).toBe('3 steps avg/day');
  expect(withPerDaySuffix(format, 'month')(3)).toBe('3 steps avg/day');
});
