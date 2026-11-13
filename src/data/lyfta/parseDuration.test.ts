import { parseDurationSeconds } from './parseDuration';

test.each([
  ['1:05:23', 3923],
  ['01:05:23', 3923],
  ['02:06:49', 7609],
  ['00:00:00', 0],
  [' 00:45:10 ', 2710],
  ['100:00:00', 360000],
  ['1:75:00', null],
  ['1:05:60', null],
  ['58:00', null],
  ['3923', null],
  ['-1:00:00', null],
  ['1:5:23', null],
  ['', null],
  [null, null],
  [undefined, null],
  [3923, null],
])('parseDurationSeconds(%p) = %p', (value, expected) => {
  expect(parseDurationSeconds(value)).toBe(expected);
});
