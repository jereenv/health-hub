import { weeklyLossRate } from './lossRate';
import type { DayPoint } from './series';
import { addDays } from '@/domain/time/localDate';

const TODAY = '2026-11-13';

/** One point per day for `days` days ending today, falling by `kgPerWeek` from `start`. */
function line(start: number, kgPerWeek: number, days = 28, every = 1): DayPoint[] {
  const points: DayPoint[] = [];
  for (let offset = days - 1; offset >= 0; offset -= every) {
    points.push({
      date: addDays(TODAY, -offset),
      value: start - (kgPerWeek / 7) * (days - 1 - offset),
      origin: 'scale',
      readingId: offset,
    });
  }
  return points;
}

test('a steady 0.7 kg per week loss over 28 days gives 0.7 kg/week and the matching percent, status healthy', () => {
  const rate = weeklyLossRate(line(80, 0.7), TODAY);
  expect(rate?.kgPerWeek).toBeCloseTo(0.7, 6);
  const meanWeight = 80 - (0.7 / 7) * 13.5;
  expect(rate?.percentPerWeek).toBeCloseTo((0.7 / meanWeight) * 100, 6);
  expect(rate?.status).toBe('healthy');
});

test('fewer than 3 points or under 14 days of span gives null', () => {
  expect(weeklyLossRate(line(80, 0.7, 28, 27), TODAY)).toBeNull(); // 2 points
  expect(weeklyLossRate(line(80, 0.7, 13), TODAY)).toBeNull(); // 12-day span
  expect(weeklyLossRate(line(80, 0.7, 14), TODAY)).toBeNull(); // 13-day span
  expect(weeklyLossRate(line(80, 0.7, 15), TODAY)).not.toBeNull(); // 14-day span
});

test('a gain gives a negative rate and status gaining; under 0.05 percent either way is steady', () => {
  const gain = weeklyLossRate(line(80, -0.5), TODAY);
  expect(gain?.kgPerWeek).toBeCloseTo(-0.5, 6);
  expect(gain?.status).toBe('gaining');
  expect(weeklyLossRate(line(80, 0.02), TODAY)?.status).toBe('steady');
  expect(weeklyLossRate(line(80, -0.02), TODAY)?.status).toBe('steady');
  expect(weeklyLossRate(line(80, 0), TODAY)?.status).toBe('steady');
});

test('slow below 0.5 percent and fast above 1 percent', () => {
  expect(weeklyLossRate(line(80, 0.2), TODAY)?.status).toBe('slow');
  expect(weeklyLossRate(line(80, 1.2), TODAY)?.status).toBe('fast');
  expect(weeklyLossRate(line(80, 0.5), TODAY)?.status).toBe('healthy');
});

test('points older than 28 days are ignored', () => {
  const old: DayPoint = { date: addDays(TODAY, -40), value: 120, origin: 'scale', readingId: 99 };
  const rate = weeklyLossRate([old, ...line(80, 0.7)], TODAY);
  expect(rate?.kgPerWeek).toBeCloseTo(0.7, 6);
  expect(weeklyLossRate([], TODAY)).toBeNull();
});
