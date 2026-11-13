import { LYFTA_MAX_PAGES, pageCapFor } from './paging';

test('allows the pages the records need plus two', () => {
  expect(pageCapFor(150, 100)).toBe(4);
  expect(pageCapFor(0, 100)).toBe(2);
  expect(pageCapFor(-5, 100)).toBe(2);
});

test('falls back to the hard ceiling for an unknown or huge total', () => {
  expect(pageCapFor(null, 100)).toBe(LYFTA_MAX_PAGES);
  expect(pageCapFor(10_000_000, 100)).toBe(LYFTA_MAX_PAGES);
});
