import { DEFAULT_STARTER } from './starterPrompts';
import type { PresetId } from './types';

test('every preset has a non-empty default starter question', () => {
  const presets: PresetId[] = ['week', 'month', 'journey', 'workout', 'custom'];
  for (const preset of presets) {
    expect(DEFAULT_STARTER[preset].trim().length).toBeGreaterThan(0);
  }
  expect(DEFAULT_STARTER.week).toBe('Review my week and suggest changes');
});
