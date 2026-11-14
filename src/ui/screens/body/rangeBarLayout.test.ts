import { rangeFor } from '@/domain/body/ranges';
import type { MetricRange } from '@/domain/body/ranges';

import { rangeBarLayout } from './rangeBarLayout';

const MALE_30: Parameters<typeof rangeFor>[1] = {
  sex: 'male',
  ageYears: 30,
  heightCm: 175,
  bmiCutoffs: 'who',
};

function bodyFat(): MetricRange {
  const range = rangeFor('body_fat_pct', MALE_30);
  if (range === null) throw new Error('body fat has a range');
  return range;
}

test('segments follow band widths over the scale and sum to one', () => {
  const { segments } = rangeBarLayout(bodyFat(), 18);
  // Scale 4 to 45 is 41 wide; the cut points are 8, 20 and 25.
  expect(segments.map((s) => s.label)).toEqual(['Low', 'Healthy', 'Slightly high', 'High']);
  expect(segments[0]!.fraction).toBeCloseTo(4 / 41);
  expect(segments[1]!.fraction).toBeCloseTo(12 / 41);
  expect(segments[2]!.fraction).toBeCloseTo(5 / 41);
  expect(segments[3]!.fraction).toBeCloseTo(20 / 41);
  expect(segments.reduce((sum, s) => sum + s.fraction, 0)).toBeCloseTo(1);
});

test('the marker sits at the value and clamps at both ends', () => {
  const range = bodyFat();
  expect(rangeBarLayout(range, 24.5).markerFraction).toBeCloseTo(20.5 / 41);
  expect(rangeBarLayout(range, 1).markerFraction).toBe(0);
  expect(rangeBarLayout(range, 80).markerFraction).toBe(1);
});

test('boundaries list the band edges, not the scale ends', () => {
  const { boundaries } = rangeBarLayout(bodyFat(), 18);
  expect(boundaries.map((b) => b.value)).toEqual([8, 20, 25]);
  expect(boundaries[0]!.fraction).toBeCloseTo(4 / 41);
});

test('open-ended bands extend to the scale bounds', () => {
  const range: MetricRange = {
    bands: [
      { label: 'Low', from: null, to: 10, status: 'low' },
      { label: 'High', from: 10, to: null, status: 'high' },
    ],
    scaleMin: 0,
    scaleMax: 40,
    source: 'test',
    sourceId: 'test',
  };
  const { segments } = rangeBarLayout(range, 5);
  expect(segments.map((s) => s.fraction)).toEqual([0.25, 0.75]);
});

test('a band wholly outside the scale is left out', () => {
  const range: MetricRange = {
    bands: [
      { label: 'Below', from: null, to: 0, status: 'low' },
      { label: 'In', from: 0, to: null, status: 'ok' },
    ],
    scaleMin: 5,
    scaleMax: 15,
    source: 'test',
    sourceId: 'test',
  };
  const { segments, boundaries } = rangeBarLayout(range, 10);
  expect(segments.map((s) => s.label)).toEqual(['In']);
  expect(boundaries).toEqual([]);
});
