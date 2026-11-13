import { parseNumeric } from './parseNumeric';

test.each([
  ['80', 80],
  ['82.5', 82.5],
  ['82,5', 82.5],
  [' 7 ', 7],
  [12, 12],
  ['', null],
  ['abc', null],
  [null, null],
  [undefined, null],
  [Number.NaN, null],
])('parseNumeric(%p) = %p', (input, expected) => expect(parseNumeric(input)).toBe(expected));
