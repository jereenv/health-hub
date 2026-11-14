import { addDays } from '@/domain/time/localDate';

import { fatVsLean } from './fatVsLean';
import type { DayPoint } from './series';
import type { Origin } from './types';

const TODAY = '2026-11-13';

function pt(offset: number, value: number, origin: Origin = 'formula'): DayPoint {
  return { date: addDays(TODAY, -offset), value, origin, readingId: offset };
}

test('fat down 1.7 and lean down 0.7 gives a share of about 0.71', () => {
  const result = fatVsLean([pt(20, 20), pt(0, 18.3)], [pt(20, 60), pt(0, 59.3)], TODAY);
  expect(result?.fatChangeKg).toBeCloseTo(-1.7, 6);
  expect(result?.leanChangeKg).toBeCloseTo(-0.7, 6);
  expect(result?.weightChangeKg).toBeCloseTo(-2.4, 6);
  expect(result?.fatShareOfLoss).toBeCloseTo(1.7 / 2.4, 6);
  expect(result?.from).toBe(addDays(TODAY, -20));
  expect(result?.to).toBe(TODAY);
  expect(result?.hollow).toBe(false);
});

test('share is null when weight change is above −0.5 kg', () => {
  const result = fatVsLean([pt(20, 20), pt(0, 19.8)], [pt(20, 60), pt(0, 59.9)], TODAY);
  expect(result?.fatShareOfLoss).toBeNull();
  expect(result?.weightChangeKg).toBeCloseTo(-0.3, 6);
});

test('lean gain with fat loss clamps the share at 1', () => {
  const result = fatVsLean([pt(20, 20), pt(0, 17)], [pt(20, 60), pt(0, 61)], TODAY);
  expect(result?.weightChangeKg).toBeCloseTo(-2, 6);
  expect(result?.fatShareOfLoss).toBe(1);
  const lossFromLean = fatVsLean([pt(20, 20), pt(0, 21)], [pt(20, 60), pt(0, 58)], TODAY);
  expect(lossFromLean?.fatShareOfLoss).toBe(0);
});

test('fewer than 2 shared dates or under 7 days apart gives null', () => {
  expect(fatVsLean([pt(0, 20)], [pt(0, 60)], TODAY)).toBeNull();
  expect(fatVsLean([pt(20, 20), pt(0, 19)], [pt(10, 60), pt(0, 59)], TODAY)).toBeNull();
  expect(fatVsLean([pt(6, 20), pt(0, 19)], [pt(6, 60), pt(0, 59)], TODAY)).toBeNull();
  expect(fatVsLean([], [], TODAY)).toBeNull();
});

test('only the latest method counts, and dates older than 30 days are ignored', () => {
  const fat = [
    pt(40, 30, 'movinglife_derived'),
    pt(25, 28, 'movinglife_derived'),
    pt(3, 20),
    pt(0, 19),
  ];
  const lean = [
    pt(40, 50, 'movinglife_derived'),
    pt(25, 52, 'movinglife_derived'),
    pt(3, 60),
    pt(0, 59.5),
  ];
  expect(fatVsLean(fat, lean, TODAY)).toBeNull(); // only 3 days of solid data
  const legacy = fatVsLean(
    [
      pt(40, 30, 'movinglife_derived'),
      pt(25, 28, 'movinglife_derived'),
      pt(10, 26, 'movinglife_derived'),
    ],
    [
      pt(40, 50, 'movinglife_derived'),
      pt(25, 52, 'movinglife_derived'),
      pt(10, 51, 'movinglife_derived'),
    ],
    TODAY,
  );
  expect(legacy?.hollow).toBe(true);
  expect(legacy?.fatChangeKg).toBeCloseTo(-2, 6);
});
