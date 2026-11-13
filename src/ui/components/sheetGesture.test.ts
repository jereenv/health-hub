import { shouldDismiss } from './sheetGesture';

test.each([
  [130, 0, true],
  [40, 900, true],
  [40, 200, false],
  [-50, -1000, false],
])('shouldDismiss(%p, %p) = %p', (translation, velocity, expected) => {
  expect(shouldDismiss(translation, velocity)).toBe(expected);
});
