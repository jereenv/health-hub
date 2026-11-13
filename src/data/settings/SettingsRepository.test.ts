import { openTestDatabase } from '@/test-support/sqljsDatabase';

import { createSqliteSettingsRepository } from './SettingsRepository';

test('settings round-trip and return null when unset', async () => {
  const repo = createSqliteSettingsRepository(await openTestDatabase());
  expect(await repo.get('lyfta.weightUnit')).toBeNull();
  await repo.set('lyfta.weightUnit', 'lbs');
  expect(await repo.get('lyfta.weightUnit')).toBe('lbs');
  await repo.set('lyfta.weightUnit', 'kg');
  expect(await repo.get('lyfta.weightUnit')).toBe('kg');
});
