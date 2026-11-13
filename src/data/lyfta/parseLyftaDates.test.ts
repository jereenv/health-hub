import { localDateKey } from '@/domain/time/localDate';

import { parseLyftaDate, parseLyftaInstant, resolveLocalWallTime } from './parseLyftaDates';

// Jest runs with TZ=America/New_York, so zoneless Lyfta times are New York wall-clock times.
test.each([
  ['2026-08-20T17:05:00.000Z', '2026-08-20T17:05:00.000Z'],
  ['2026-08-20T17:05:00Z', '2026-08-20T17:05:00.000Z'],
  ['2026-08-20T17:05:00.5Z', '2026-08-20T17:05:00.500Z'],
  ['2026-08-20T13:05:00-04:00', '2026-08-20T17:05:00.000Z'],
  ['2026-08-20T22:35:00+05:30', '2026-08-20T17:05:00.000Z'],
  ['2026-08-20T17:05Z', '2026-08-20T17:05:00.000Z'],
  // Zoneless means the owner's local wall-clock time (EDT in August, EST in January).
  ['2026-08-20 13:05:00', '2026-08-20T17:05:00.000Z'],
  ['2026-08-20T13:05:00', '2026-08-20T17:05:00.000Z'],
  ['2026-01-15 13:05:00', '2026-01-15T18:05:00.000Z'],
  ['2026-08-20 13:05', '2026-08-20T17:05:00.000Z'],
  // Late evening local time falls on the next UTC day.
  ['2026-11-12 23:39:00', '2026-11-13T04:39:00.000Z'],
  ['2026-02-30T00:00:00Z', null],
  ['2026-02-30 10:00:00', null],
  ['2026-13-01 10:00:00', null],
  ['2026-08-20 24:00:00', null],
  ['2026-08-20 10:60:00', null],
  ['2026-08-20 10:00:60', null],
  ['2026-08-20T10:00:00+24:00', null],
  ['2026-08-20T10:00:00+05:60', null],
  ['not a date', null],
  ['', null],
  [1724173500000, null],
  [null, null],
  [undefined, null],
])('parseLyftaInstant(%p) = %p', (value, expected) => {
  expect(parseLyftaInstant(value)).toBe(expected);
});

describe('DST edges (rule: a gap shifts forward, an overlap takes the first occurrence)', () => {
  test('a non-existent local time moves forward by the gap', () => {
    // 02:30 does not exist on 2026-03-08; it becomes 03:30 EDT = 07:30Z.
    expect(parseLyftaInstant('2026-03-08 02:30:00')).toBe('2026-03-08T07:30:00.000Z');
  });

  test('an ambiguous local time takes the earlier occurrence', () => {
    // 01:30 happens twice on 2026-11-01; the first is EDT = 05:30Z.
    expect(parseLyftaInstant('2026-11-01 01:30:00')).toBe('2026-11-01T05:30:00.000Z');
  });
});

test('a late-evening local time keeps its local DateKey', () => {
  const instant = parseLyftaInstant('2026-11-12 23:39:00');
  expect(instant).toBe('2026-11-13T04:39:00.000Z');
  expect(localDateKey(instant as string)).toBe('2026-11-12');
});

test.each([
  ['2026-11-14', '2026-11-14'],
  ['2026-11-14T00:00:00.000Z', '2026-11-14'],
  ['2026-11-14 23:39:00', '2026-11-14'],
  ['2026-13-01', null],
  ['2026-02-30', null],
  ['14-11-2026', null],
  ['', null],
  [null, null],
  [20261114, null],
])('parseLyftaDate(%p) = %p', (value, expected) => {
  expect(parseLyftaDate(value)).toBe(expected);
});

describe('resolveLocalWallTime does not depend on the engine', () => {
  // A hand-written New York clock: EST (-5h) until 2026-03-08T07:00Z, EDT (-4h) until
  // 2026-11-01T06:00Z, then EST again. It reads wall time only, never the Date constructor.
  const SPRING = Date.UTC(2026, 2, 8, 7);
  const FALL = Date.UTC(2026, 10, 1, 6);
  const HOUR = 3_600_000;
  const readWall = (ms: number): number => {
    const offset = ms >= SPRING && ms < FALL ? -4 * HOUR : -5 * HOUR;
    return ms + offset;
  };

  test('a gap shifts forward by the gap', () => {
    expect(
      new Date(resolveLocalWallTime(Date.UTC(2026, 2, 8, 2, 30), readWall)).toISOString(),
    ).toBe('2026-03-08T07:30:00.000Z');
  });

  test('an overlap takes the first occurrence', () => {
    expect(
      new Date(resolveLocalWallTime(Date.UTC(2026, 10, 1, 1, 30), readWall)).toISOString(),
    ).toBe('2026-11-01T05:30:00.000Z');
  });

  test('ordinary times resolve exactly', () => {
    expect(
      new Date(resolveLocalWallTime(Date.UTC(2026, 7, 20, 13, 5), readWall)).toISOString(),
    ).toBe('2026-08-20T17:05:00.000Z');
    expect(
      new Date(resolveLocalWallTime(Date.UTC(2026, 0, 15, 13, 5), readWall)).toISOString(),
    ).toBe('2026-01-15T18:05:00.000Z');
  });
});
