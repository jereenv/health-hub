import { bucketSeries, bucketStart, fillEmptyBuckets, nextBucketStart } from './buckets';

describe('bucketStart and nextBucketStart', () => {
  test('day, week and month starts', () => {
    expect(bucketStart('2026-11-12', 'day')).toBe('2026-11-12');
    expect(bucketStart('2026-11-12', 'week')).toBe('2026-11-09');
    expect(bucketStart('2026-11-12', 'month')).toBe('2026-11-01');
  });

  test('next bucket start steps one bucket, including across a year end', () => {
    expect(nextBucketStart('2026-11-12', 'day')).toBe('2026-11-13');
    expect(nextBucketStart('2026-11-09', 'week')).toBe('2026-11-16');
    expect(nextBucketStart('2026-11-01', 'month')).toBe('2026-12-01');
    expect(nextBucketStart('2026-12-01', 'month')).toBe('2027-01-01');
    expect(nextBucketStart('2026-01-01', 'month')).toBe('2026-02-01');
  });
});

describe('bucketSeries', () => {
  test('bucketSeries sums by week across the DST change', () => {
    const points = bucketSeries(
      [
        { date: '2026-10-29', value: 1 },
        { date: '2026-11-01', value: 2 },
        { date: '2026-11-02', value: 4 },
      ],
      'week',
      'sum',
    );
    expect(points).toEqual([
      { start: '2026-10-26', value: 3, count: 2 },
      { start: '2026-11-02', value: 4, count: 1 },
    ]);
  });

  test('bucketSeries takes the max per month and the mean when asked', () => {
    const values = [
      { date: '2026-10-03', value: 10 },
      { date: '2026-10-20', value: 30 },
      { date: '2026-11-02', value: 5 },
    ];
    expect(bucketSeries(values, 'month', 'max')).toEqual([
      { start: '2026-10-01', value: 30, count: 2 },
      { start: '2026-11-01', value: 5, count: 1 },
    ]);
    expect(bucketSeries(values, 'month', 'mean')).toEqual([
      { start: '2026-10-01', value: 20, count: 2 },
      { start: '2026-11-01', value: 5, count: 1 },
    ]);
  });

  test('unsorted input gives ascending output and empty input gives nothing', () => {
    const points = bucketSeries(
      [
        { date: '2026-11-05', value: 1 },
        { date: '2026-11-01', value: 1 },
      ],
      'day',
      'sum',
    );
    expect(points.map((p) => p.start)).toEqual(['2026-11-01', '2026-11-05']);
    expect(bucketSeries([], 'day', 'sum')).toEqual([]);
  });
});

describe('fillEmptyBuckets', () => {
  test('fillEmptyBuckets zero-fills missing weeks between from and to', () => {
    const filled = fillEmptyBuckets(
      [
        { start: '2026-10-19', value: 7, count: 2 },
        { start: '2026-11-02', value: 3, count: 1 },
      ],
      'week',
      '2026-10-21',
      '2026-11-05',
    );
    expect(filled).toEqual([
      { start: '2026-10-19', value: 7, count: 2 },
      { start: '2026-10-26', value: 0, count: 0 },
      { start: '2026-11-02', value: 3, count: 1 },
    ]);
  });

  test('points outside the range are dropped', () => {
    const filled = fillEmptyBuckets(
      [{ start: '2026-09-01', value: 9, count: 1 }],
      'month',
      '2026-10-15',
      '2026-11-15',
    );
    expect(filled).toEqual([
      { start: '2026-10-01', value: 0, count: 0 },
      { start: '2026-11-01', value: 0, count: 0 },
    ]);
  });
});
