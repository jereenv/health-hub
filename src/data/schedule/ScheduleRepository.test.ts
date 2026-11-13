import type { ParsedScheduledWorkout } from '@/data/lyfta/parseSchedule';
import { openTestDatabase } from '@/test-support/sqljsDatabase';

import { createSqliteScheduleRepository } from './ScheduleRepository';

const SYNCED = '2026-11-12T10:00:00.000Z';

function entry(id: string, date: string, title = 'Workout'): ParsedScheduledWorkout {
  return {
    item: {
      lyftaId: id,
      date,
      title,
      templateId: null,
      source: null,
      status: null,
      completed: false,
    },
    rawJson: JSON.stringify({ id }),
  };
}

async function setup() {
  const db = await openTestDatabase();
  return { db, repo: createSqliteScheduleRepository(db) };
}

test('replaceRange upserts and deletes missing items only inside the range', async () => {
  const { repo } = await setup();
  await repo.replaceRange(
    '2026-11-01',
    '2026-11-30',
    [
      entry('before', '2026-10-31'),
      entry('keep', '2026-11-05', 'Old title'),
      entry('gone', '2026-11-06'),
      entry('after', '2026-12-01'),
    ],
    SYNCED,
    false,
  );

  const result = await repo.replaceRange(
    '2026-11-01',
    '2026-11-30',
    [entry('keep', '2026-11-05', 'New title'), entry('new', '2026-11-07')],
    SYNCED,
    true,
  );

  expect(result).toEqual({ upserted: 2, deleted: 1 });
  const all = await repo.listBetween('2026-01-01', '2026-12-31');
  expect(all.map((w) => w.lyftaId)).toEqual(['before', 'keep', 'new', 'after']);
  expect(all.find((w) => w.lyftaId === 'keep')?.title).toBe('New title');
});

test('replaceRange deletes an item whose date moved out of the range', async () => {
  const { repo } = await setup();
  await repo.replaceRange('2026-11-01', '2026-11-30', [entry('a', '2026-11-05')], SYNCED, true);
  const result = await repo.replaceRange('2026-11-01', '2026-11-30', [], SYNCED, true);
  expect(result.deleted).toBe(1);
  expect(await repo.count()).toBe(0);
});

test('replaceRange keeps everything when deleteMissing is false', async () => {
  const { repo } = await setup();
  await repo.replaceRange(
    '2026-11-01',
    '2026-11-30',
    [entry('a', '2026-11-05'), entry('b', '2026-11-06')],
    SYNCED,
    false,
  );
  const result = await repo.replaceRange(
    '2026-11-01',
    '2026-11-30',
    [entry('a', '2026-11-05')],
    SYNCED,
    false,
  );
  expect(result).toEqual({ upserted: 1, deleted: 0 });
  expect(await repo.count()).toBe(2);
});

test('replaceRange stores the flags and raw JSON round-trip', async () => {
  const { repo, db } = await setup();
  const done = entry('a', '2026-11-05');
  done.item.completed = true;
  done.item.templateId = 't1';
  await repo.replaceRange('2026-11-01', '2026-11-30', [done], SYNCED, true);
  expect((await repo.listBetween('2026-11-05', '2026-11-05'))[0]).toEqual(done.item);
  expect(await db.first('SELECT raw_json, synced_at FROM scheduled_workout')).toEqual({
    raw_json: '{"id":"a"}',
    synced_at: SYNCED,
  });
});

test('listBetween is inclusive and ordered by date then title', async () => {
  const { repo } = await setup();
  await repo.replaceRange(
    '2026-11-01',
    '2026-11-30',
    [
      entry('1', '2026-11-06', 'B'),
      entry('2', '2026-11-05', 'Z'),
      entry('3', '2026-11-06', 'A'),
      entry('4', '2026-11-07', 'Q'),
      entry('5', '2026-11-04', 'Q'),
    ],
    SYNCED,
    false,
  );
  const rows = await repo.listBetween('2026-11-05', '2026-11-06');
  expect(rows.map((w) => w.lyftaId)).toEqual(['2', '3', '1']);
});

test('replaceRange rolls back everything when a write fails', async () => {
  const { repo } = await setup();
  await repo.replaceRange('2026-11-01', '2026-11-30', [entry('a', '2026-11-05')], SYNCED, true);
  const bad = entry('b', '2026-11-06');
  (bad.item as { title: unknown }).title = null; // NOT NULL violation
  await expect(
    repo.replaceRange('2026-11-01', '2026-11-30', [bad], SYNCED, true),
  ).rejects.toThrow();
  expect((await repo.listBetween('2026-11-01', '2026-11-30')).map((w) => w.lyftaId)).toEqual(['a']);
});
