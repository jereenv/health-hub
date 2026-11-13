import { toChartData } from './chartData';

const point = (start: string, value: number) => ({ start, value, count: 1 });

test('toChartData labels day, week and month points', () => {
  const day = toChartData([point('2026-11-11', 5), point('2026-11-12', 6)], 'day', '2026-11-12');
  expect(day.map((d) => [d.tooltipLabel, d.axisLabel])).toEqual([
    ['Wed 11 Nov', '11 Nov'],
    ['Thu 12 Nov', 'Today'],
  ]);
  expect(day[1]).toMatchObject({ key: '2026-11-12', value: 6 });

  const week = toChartData([point('2026-11-09', 1)], 'week', '2026-11-12');
  expect(week[0]).toMatchObject({ tooltipLabel: 'Week of 9 Nov', axisLabel: '9 Nov' });

  const month = toChartData([point('2026-11-01', 1)], 'month', '2026-11-12');
  expect(month[0]).toMatchObject({ tooltipLabel: 'November 2026', axisLabel: 'Nov' });
});

test('the last day point is not Today when it is an earlier day', () => {
  const day = toChartData([point('2026-11-10', 5)], 'day', '2026-11-12');
  expect(day[0]?.axisLabel).toBe('10 Nov');
});
