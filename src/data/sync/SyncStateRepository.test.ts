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
    lastSkipped: 0,
    deletionPause: null,
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
    lastSkipped: 0,
    deletionPause: null,
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
    lastSkipped: 0,
    deletionPause: null,
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
    lastSkipped: 0,
    deletionPause: null,
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
    lastSkipped: 0,
    deletionPause: null,
  });
});

test('saveCursor creates the row when none exists and can clear the cursor', async () => {
  const repo = await setup();
  await repo.saveCursor('lyfta', 'page-1');
  expect((await repo.get('lyfta')).cursor).toBe('page-1');
  await repo.saveCursor('lyfta', null);
  expect((await repo.get('lyfta')).cursor).toBeNull();
});

test('reset forgets cursor, success, error, skipped count and deletion pause', async () => {
  const repo = await setup();
  await repo.recordSuccess('lyfta', '2026-11-12T10:00:00.000Z', 'x', {
    skipped: 3,
    deletionPause: {
      reason: 'unreadable',
      candidateIds: [1],
      skipped: 3,
      pausedAt: '2026-11-12T09:00:00.000Z',
    },
  });
  await repo.recordError('lyfta', 'boom', '2026-11-12T11:00:00.000Z');
  await repo.reset('lyfta');
  expect(await repo.get('lyfta')).toEqual({
    source: 'lyfta',
    cursor: null,
    lastSuccessAt: null,
    lastError: null,
    lastErrorAt: null,
    lastSkipped: 0,
    deletionPause: null,
  });
});

test('recordSuccess stores the skipped count and deletion pause', async () => {
  const repo = await setup();
  const deletionPause = {
    reason: 'error' as const,
    candidateIds: [4, 9],
    skipped: 0,
    pausedAt: '2026-11-12T09:00:00.000Z',
  };
  await repo.recordSuccess('lyfta', '2026-11-12T10:00:00.000Z', null, {
    skipped: 2,
    deletionPause,
  });
  expect(await repo.get('lyfta')).toMatchObject({ lastSkipped: 2, deletionPause });
});

test('recordSuccess without details resets the skipped count and pause', async () => {
  const repo = await setup();
  await repo.recordSuccess('lyfta', '2026-11-12T10:00:00.000Z', null, {
    skipped: 2,
    deletionPause: {
      reason: 'unreadable',
      candidateIds: [],
      skipped: 2,
      pausedAt: '2026-11-12T09:00:00.000Z',
    },
  });
  await repo.recordSuccess('lyfta', '2026-11-12T11:00:00.000Z', null);
  expect(await repo.get('lyfta')).toMatchObject({ lastSkipped: 0, deletionPause: null });
});

test('recordError keeps the deletion pause and skipped count', async () => {
  const repo = await setup();
  const deletionPause = {
    reason: 'unreadable' as const,
    candidateIds: [7],
    skipped: 1,
    pausedAt: '2026-11-12T09:00:00.000Z',
  };
  await repo.recordSuccess('lyfta', '2026-11-12T10:00:00.000Z', null, {
    skipped: 1,
    deletionPause,
  });
  await repo.recordError('lyfta', 'boom', '2026-11-12T11:00:00.000Z');
  expect(await repo.get('lyfta')).toMatchObject({ lastSkipped: 1, deletionPause });
});

test.each([
  ['invalid JSON', '{nope'],
  ['a non-object', '5'],
  [
    'an unknown reason',
    '{"reason":"x","candidateIds":[],"skipped":0,"pausedAt":"2026-11-12T09:00:00.000Z"}',
  ],
  [
    'non-array candidateIds',
    '{"reason":"error","candidateIds":"1","skipped":0,"pausedAt":"2026-11-12T09:00:00.000Z"}',
  ],
  [
    'non-integer candidateIds',
    '{"reason":"error","candidateIds":[1,"a"],"skipped":0,"pausedAt":"2026-11-12T09:00:00.000Z"}',
  ],
  [
    'a missing skipped count',
    '{"reason":"error","candidateIds":[],"pausedAt":"2026-11-12T09:00:00.000Z"}',
  ],
  ['a missing pausedAt', '{"reason":"error","candidateIds":[],"skipped":0}'],
  ['a non-string pausedAt', '{"reason":"error","candidateIds":[],"skipped":0,"pausedAt":5}'],
])('a stored deletion pause with %s reads as null', async (_name, stored) => {
  const db = await openTestDatabase();
  const repo = createSqliteSyncStateRepository(db);
  await db.run("INSERT INTO sync_state (source, deletion_pause) VALUES ('lyfta', ?)", [stored]);
  expect((await repo.get('lyfta')).deletionPause).toBeNull();
});
