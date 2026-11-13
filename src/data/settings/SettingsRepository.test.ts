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

test("a settings write survives another transaction's rollback", async () => {
  const db = await openTestDatabase();
  const repo = createSqliteSettingsRepository(db);
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  let markerInserted: () => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    markerInserted = resolve;
  });

  const txA = db.transaction(async () => {
    await db.run("INSERT INTO setting (key, value) VALUES ('marker', 'x')");
    markerInserted();
    await gate;
    throw new Error('A fails');
  });
  const txAResult = expect(txA).rejects.toThrow('A fails');
  await started;
  const write = repo.set('lyfta.weightUnit', 'lb');

  release();
  await txAResult;
  await write;

  expect(await repo.get('lyfta.weightUnit')).toBe('lb');
  expect(await db.first("SELECT value FROM setting WHERE key = 'marker'")).toBeNull();
});
