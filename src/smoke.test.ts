import { z } from 'zod';

test('tooling runs TypeScript tests with the @/ alias available', () => {
  expect(z.number().parse(1)).toBe(1);
});
