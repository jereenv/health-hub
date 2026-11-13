import { chunkRange, parseCursor, planImport } from './importWindow';

const TODAY = '2026-11-13';

test('no cursor is a full import from the earliest record to tomorrow', () => {
  expect(
    planImport({ cursor: null, historyGranted: true, today: TODAY, earliest: '2026-01-15' }),
  ).toEqual({
    mode: 'full',
    range: { from: '2026-01-15', toExclusive: '2026-11-14' },
  });
});

test('no data at all falls back to the last 30 days', () => {
  expect(planImport({ cursor: null, historyGranted: false, today: TODAY, earliest: null })).toEqual(
    {
      mode: 'full',
      range: { from: '2026-10-14', toExclusive: '2026-11-14' },
    },
  );
});

test('a cursor gives an incremental window starting 14 days before syncedThrough', () => {
  const cursor = { v: 1 as const, syncedThrough: '2026-11-12', history: true };
  expect(planImport({ cursor, historyGranted: true, today: TODAY, earliest: null })).toEqual({
    mode: 'incremental',
    range: { from: '2026-10-29', toExclusive: '2026-11-14' },
  });
});

test('history newly granted after a run without it is a full import', () => {
  const cursor = { v: 1 as const, syncedThrough: '2026-11-12', history: false };
  expect(
    planImport({ cursor, historyGranted: true, today: TODAY, earliest: '2026-01-15' }).mode,
  ).toBe('full');
  expect(planImport({ cursor, historyGranted: false, today: TODAY, earliest: null }).mode).toBe(
    'incremental',
  );
});

test('history that was granted and is now revoked stays incremental', () => {
  const cursor = { v: 1 as const, syncedThrough: '2026-11-12', history: true };
  expect(planImport({ cursor, historyGranted: false, today: TODAY, earliest: null }).mode).toBe(
    'incremental',
  );
});

test('a malformed cursor counts as no cursor', () => {
  expect(parseCursor(null)).toBeNull();
  expect(parseCursor('not json')).toBeNull();
  expect(parseCursor('{"v":2,"syncedThrough":"2026-11-12","history":true}')).toBeNull();
  expect(parseCursor('{"v":1,"syncedThrough":"2026-13-45","history":true}')).toBeNull();
  expect(parseCursor('{"v":1,"syncedThrough":"2026-11-12"}')).toBeNull();
  expect(parseCursor('[]')).toBeNull();
  expect(parseCursor('{"v":1,"syncedThrough":"2026-11-12","history":false}')).toEqual({
    v: 1,
    syncedThrough: '2026-11-12',
    history: false,
  });
});

test('chunkRange covers the range exactly with no empty chunk', () => {
  const chunks = chunkRange({ from: '2026-01-01', toExclusive: '2026-07-20' }, 92);
  expect(chunks).toHaveLength(3);
  expect(chunks[0]).toEqual({ from: '2026-01-01', toExclusive: '2026-04-03' });
  expect(chunks[chunks.length - 1]!.toExclusive).toBe('2026-07-20');
  chunks.forEach((chunk, index) => {
    expect(chunk.from < chunk.toExclusive).toBe(true);
    if (index > 0) expect(chunk.from).toBe(chunks[index - 1]!.toExclusive);
  });
  expect(chunkRange({ from: '2026-01-01', toExclusive: '2026-01-01' }, 92)).toEqual([]);
  expect(chunkRange({ from: '2026-01-01', toExclusive: '2026-04-03' }, 92)).toHaveLength(1);
});
