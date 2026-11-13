import {
  axisLabelIndexes,
  barPath,
  describeSeries,
  linePath,
  nearestIndex,
  valueDomain,
  xPositions,
  yScale,
} from './geometry';
import type { PlotBox } from './geometry';

const BOX: PlotBox = { width: 300, height: 100, top: 10, bottom: 20, left: 0, right: 40 };

test('empty data gives a safe 0–1 domain', () =>
  expect(valueDomain([], { includeZero: false })).toMatchObject({ min: 0, max: 1 }));

test('a flat or single-point series gets a finite domain', () => {
  const d = valueDomain([99, 99], { includeZero: false });
  expect(d.min).toBeLessThan(99);
  expect(d.max).toBeGreaterThan(99);
  expect(d.ticks[1]).toBeCloseTo(99);
  expect(Number.isFinite(valueDomain([0], { includeZero: false }).max)).toBe(true);
});

test('a sloped line domain pads 10% of the span either side', () => {
  const d = valueDomain([10, 20], { includeZero: false });
  expect(d.min).toBeCloseTo(9);
  expect(d.max).toBeCloseTo(21);
  expect(d.ticks).toEqual([d.min, (d.min + d.max) / 2, d.max]);
});

test('bars start at zero with 10% headroom', () => {
  const d = valueDomain([10, 20], { includeZero: true });
  expect(d.min).toBe(0);
  expect(d.max).toBeCloseTo(22, 9);
});

test('all-zero bars fall back to 0–1', () =>
  expect(valueDomain([0, 0], { includeZero: true })).toMatchObject({ min: 0, max: 1 }));

test('line x positions span the plot; a single point is centred', () => {
  expect(xPositions(3, BOX, 'line')).toEqual([0, 130, 260]);
  expect(xPositions(1, BOX, 'line')).toEqual([130]);
  expect(xPositions(2, BOX, 'bar')).toEqual([65, 195]);
  expect(xPositions(0, BOX, 'bar')).toEqual([]);
});

test('yScale maps the domain onto the plot, max at the top', () => {
  const y = yScale({ min: 0, max: 10, ticks: [0, 5, 10] }, BOX);
  expect(y(10)).toBe(10);
  expect(y(0)).toBe(80);
});

test('linePath joins points with M and L', () =>
  expect(linePath([0, 10], [5, 6])).toBe('M0 5L10 6'));

test('nearestIndex picks the closest point and clamps outside touches', () => {
  expect(nearestIndex([0, 100, 200], 90)).toBe(1);
  expect(nearestIndex([0, 100, 200], -50)).toBe(0);
  expect(nearestIndex([0, 100, 200], 999)).toBe(2);
  expect(nearestIndex([], 5)).toBe(-1);
});

function arcRadii(path: string): number[] {
  return [...path.matchAll(/A([\d.]+) /g)].map((m) => Number(m[1]));
}

test('barPath clamps corner radii on short bars', () => {
  const p = barPath(50, 20, 99, 100);
  expect(p).not.toContain('NaN');
  for (const r of arcRadii(p)) expect(r).toBeLessThanOrEqual(0.5);
});

test('barPath uses top radius 4 and bottom radius 2 on tall bars', () => {
  expect(arcRadii(barPath(50, 20, 10, 100))).toEqual([4, 4, 2, 2]);
});

test.each([
  [0, []],
  [1, [0]],
  [2, [0, 1]],
  [8, [0, 3, 7]],
])('axisLabelIndexes(%p)', (n, expected) => expect(axisLabelIndexes(n)).toEqual(expected));

test('describeSeries summarises first, last and highest', () => {
  expect(
    describeSeries('Weekly volume', 'last 8 weeks', [24.1, 31, 27.4], (v) => `${v.toFixed(1)} t`),
  ).toBe('Weekly volume, last 8 weeks: from 24.1 t to 27.4 t, highest 31.0 t.');
  expect(describeSeries('Weekly volume', 'last 8 weeks', [], String)).toBe(
    'Weekly volume, last 8 weeks: no data yet.',
  );
});
