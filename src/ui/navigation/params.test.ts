import { parseIdParam } from './params';

test.each([
  ['42', 42],
  [['42'], 42],
  ['4.2', null],
  ['-1', null],
  ['0', null],
  ['abc', null],
  [undefined, null],
])('parseIdParam(%p) = %p', (param, expected) => {
  expect(parseIdParam(param)).toBe(expected);
});
