import { formatCount, formatDuration, formatInteger, formatSignedDelta } from './numbers';

test.each([
  [3480, '58 min'],
  [3600, '1h'],
  [9660, '2h 41m'],
  [0, '0 min'],
])('formatDuration(%p) = %p', (s, t) => expect(formatDuration(s)).toBe(t));

test.each([
  [4, 0, '+4'],
  [-1.3, 1, '−1.3'],
  [0, 1, '0'],
  [-0.04, 1, '0'],
])('formatSignedDelta(%p, %p) = %p', (v, d, t) => expect(formatSignedDelta(v, d)).toBe(t));

test('formatCount and formatInteger', () => {
  expect(formatCount(1, 'PR')).toBe('1 PR');
  expect(formatCount(2, 'PR')).toBe('2 PRs');
  expect(formatCount(2, 'workout', 'workouts')).toBe('2 workouts');
  expect(formatInteger(9412)).toBe('9,412');
  expect(formatInteger(-1234567)).toBe('−1,234,567');
  expect(formatInteger(12)).toBe('12');
});
