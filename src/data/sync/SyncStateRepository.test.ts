import { openTestDatabase } from '@/test-support/sqljsDatabase';

import { createSqliteSyncStateRepository } from './SyncStateRepository';

async function setup() {
  const db = await openTestDatabase();
  return createSqliteSyncStateRepository(db);
}

test('returns an empty state for a source never synced', async () => {
  const repo = await setup();
  expect(await repo.get('lyfta')).toEqual({
    source: 'lyfta',
    cursor: null,
    lastSuccessAt: null,
    lastError: null,
    lastErrorAt: null,
  });
});

test('recordSuccess stores time and cursor and clears the last error', async () => {
  const repo = await setup();
  await repo.recordError('lyfta', 'boom', '2026-11-12T09:00:00.000Z');
  await repo.recordSuccess('lyfta', '2026-11-12T10:00:00.000Z', 'page-3');
  expect(await repo.get('lyfta')).toEqual({
    source: 'lyfta',
    cursor: 'page-3',
    lastSuccessAt: '2026-11-12T10:00:00.000Z',
    lastError: null,
    lastErrorAt: null,
  });
});

test('recordError keeps the last success time', async () => {
  const repo = await setup();
  await repo.recordSuccess('lyfta', '2026-11-12T10:00:00.000Z', 'page-3');
  await repo.recordError('lyfta', 'boom', '2026-11-12T11:00:00.000Z');
  expect(await repo.get('lyfta')).toEqual({
    source: 'lyfta',
    cursor: 'page-3',
    lastSuccessAt: '2026-11-12T10:00:00.000Z',
    lastError: 'boom',
    lastErrorAt: '2026-11-12T11:00:00.000Z',
  });
});

test('recordError on a source with no row leaves cursor and success time null', async () => {
  const repo = await setup();
  await repo.recordError('lyfta', 'boom', '2026-11-12T11:00:00.000Z');
  expect(await repo.get('lyfta')).toEqual({
    source: 'lyfta',
    cursor: null,
    lastSuccessAt: null,
    lastError: 'boom',
    lastErrorAt: '2026-11-12T11:00:00.000Z',
  });
});

test('saveCursor updates only the cursor', async () => {
  const repo = await setup();
  await repo.recordSuccess('lyfta', '2026-11-12T10:00:00.000Z', 'page-3');
  await repo.recordError('lyfta', 'boom', '2026-11-12T11:00:00.000Z');
  await repo.saveCursor('lyfta', 'page-4');
  expect(await repo.get('lyfta')).toEqual({
    source: 'lyfta',
    cursor: 'page-4',
    lastSuccessAt: '2026-11-12T10:00:00.000Z',
    lastError: 'boom',
    lastErrorAt: '2026-11-12T11:00:00.000Z',
  });
});

test('saveCursor creates the row when none exists and can clear the cursor', async () => {
  const repo = await setup();
  await repo.saveCursor('lyfta', 'page-1');
  expect((await repo.get('lyfta')).cursor).toBe('page-1');
  await repo.saveCursor('lyfta', null);
  expect((await repo.get('lyfta')).cursor).toBeNull();
});
