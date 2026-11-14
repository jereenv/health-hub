import { SYNTHETIC_TODAY, syntheticJourney, syntheticWeek } from './__fixtures__/synthetic';
import {
  detailLevel,
  earliestDataDate,
  periodTitle,
  resolvePeriod,
  weekStartsIn,
  weekWithin,
} from './period';
import type { ExportRequest, PresetId } from './types';

const TODAY = SYNTHETIC_TODAY;

function request(preset: PresetId, extra: Partial<ExportRequest> = {}): ExportRequest {
  return {
    preset,
    sections: { body: true, workouts: true, activity: true, sleep: true, heartRate: true },
    starter: '',
    workoutId: null,
    custom: null,
    includeCsv: false,
    ...extra,
  };
}

function resolve(
  preset: PresetId,
  extra: Partial<ExportRequest> = {},
  first: string | null = null,
) {
  return resolvePeriod({
    request: request(preset, extra),
    today: TODAY,
    unit: 'kg',
    firstDataDate: first,
  });
}

test('week is the 7 days ending today with the 7 days before as previous; today included', () => {
  const view = resolve('week')!;
  expect(view.window).toEqual({ from: '2026-11-06', to: '2026-11-12' });
  expect(view.previous).toEqual({ from: '2026-10-30', to: '2026-11-05' });
  expect(view.days).toBe(7);
  expect(view.includesToday).toBe(true);
  expect(view.level).toBe('full');
  expect(view.comparisonLabel).toBe('previous period');
});

test('month is 30 days ending today with the 30 days before as previous', () => {
  const view = resolve('month')!;
  expect(view.window).toEqual({ from: '2026-10-14', to: '2026-11-12' });
  expect(view.previous).toEqual({ from: '2026-09-14', to: '2026-10-13' });
  expect(view.days).toBe(30);
  expect(view.level).toBe('medium');
});

test('custom keeps its range, clamps a future end to today, previous is the same length before', () => {
  const kept = resolve('custom', { custom: { from: '2026-11-02', to: '2026-11-04' } })!;
  expect(kept.window).toEqual({ from: '2026-11-02', to: '2026-11-04' });
  expect(kept.previous).toEqual({ from: '2026-10-30', to: '2026-11-01' });
  expect(kept.includesToday).toBe(false);

  const clamped = resolve('custom', { custom: { from: '2026-11-10', to: '2026-11-30' } })!;
  expect(clamped.window).toEqual({ from: '2026-11-10', to: TODAY });
  expect(clamped.days).toBe(3);
  expect(clamped.includesToday).toBe(true);
});

test('journey runs from the first data day to today, has no previous, compares first 7 days with now', () => {
  const view = resolve('journey', {}, '2026-07-16')!;
  expect(view.window).toEqual({ from: '2026-07-16', to: TODAY });
  expect(view.days).toBe(120);
  expect(view.comparisonLabel).toBe('journey start');
  expect(view.level).toBe('long');
  // The first 7 days stand in for "previous", so the body section can compare against them.
  expect(view.previous).toEqual({ from: '2026-07-16', to: '2026-07-22' });
});

test('a journey too short for two separate weeks has no comparison', () => {
  expect(resolve('journey', {}, '2026-11-08')!.previous).toBeNull();
});

test('a journey with no data at all is today..today and does not throw', () => {
  const view = resolve('journey', {}, null)!;
  expect(view.window).toEqual({ from: TODAY, to: TODAY });
  expect(view.days).toBe(1);
  expect(view.previous).toBeNull();
});

test('a single workout has no period', () => {
  expect(resolve('workout')).toBeNull();
});

test('detailLevel: week and custom up to 14 days are full, month and 15–62 are medium, journey and over 62 are long', () => {
  expect(detailLevel('week', 7)).toBe('full');
  expect(detailLevel('custom', 14)).toBe('full');
  expect(detailLevel('custom', 15)).toBe('medium');
  expect(detailLevel('custom', 62)).toBe('medium');
  expect(detailLevel('custom', 63)).toBe('long');
  expect(detailLevel('month', 30)).toBe('medium');
  expect(detailLevel('journey', 5)).toBe('long');
});

test('periodTitle formats same-month, cross-month and cross-year ranges', () => {
  expect(periodTitle('week', { from: '2026-11-06', to: '2026-11-12' })).toBe(
    '# Weekly check-in · 6–12 Nov 2026',
  );
  expect(periodTitle('month', { from: '2026-10-14', to: '2026-11-12' })).toBe(
    '# Month review · 14 Oct–12 Nov 2026',
  );
  expect(periodTitle('custom', { from: '2025-12-20', to: '2026-01-12' })).toBe(
    '# Custom export · 20 Dec 2025–12 Jan 2026',
  );
  expect(periodTitle('journey', { from: '2026-11-12', to: '2026-11-12' })).toBe(
    '# Whole journey · 12 Nov 2026',
  );
});

test('earliestDataDate is the minimum over readings, workouts, activity, sleep wake dates and heart rate, null with no data', () => {
  const empty = {
    ...syntheticWeek(),
    readings: [],
    workouts: [],
    activity: [],
    sleep: [],
    heartRate: [],
  };
  expect(earliestDataDate(empty)).toBeNull();
  expect(earliestDataDate(syntheticWeek())).toBe('2026-10-16');
  expect(earliestDataDate(syntheticJourney())).toBe('2026-07-16');
  expect(
    earliestDataDate({
      ...empty,
      heartRate: [{ date: '2026-03-01', minBpm: 1, avgBpm: 2, maxBpm: 3 }],
    }),
  ).toBe('2026-03-01');
  expect(earliestDataDate({ ...empty, sleep: syntheticWeek().sleep })).toBe('2026-11-01');
  // A row with every value null is not data.
  expect(
    earliestDataDate({
      ...empty,
      activity: [
        { date: '2026-01-01', steps: null, distanceM: null, activeKcal: null, totalKcal: null },
      ],
    }),
  ).toBeNull();
});

test('weekStartsIn lists the Mondays touching a window and weekWithin clips the week to it', () => {
  const window = { from: '2026-11-06', to: '2026-11-12' };
  expect(weekStartsIn(window)).toEqual(['2026-11-02', '2026-11-09']);
  expect(weekWithin('2026-11-02', window)).toEqual({ from: '2026-11-06', to: '2026-11-08' });
  expect(weekWithin('2026-11-09', window)).toEqual({ from: '2026-11-09', to: '2026-11-12' });
});
