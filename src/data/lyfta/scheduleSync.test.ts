import { createSqliteScheduleRepository } from '@/data/schedule/ScheduleRepository';
import { createSqliteSyncStateRepository } from '@/data/sync/SyncStateRepository';
import { openTestDatabase } from '@/test-support/sqljsDatabase';

import type { LyftaClient } from './LyftaClient';
import { LyftaError } from './LyftaError';
import { SCHEDULE_PAGE_SIZE, scheduleWindow, syncLyftaSchedule } from './scheduleSync';

const fixture = require('@/data/lyfta/__fixtures__/schedule-page.json');

// 2026-11-12 10:00 in New York.
const NOW = new Date('2026-11-12T15:00:00.000Z');

interface Call {
  from?: string;
  to?: string;
  includeCompleted?: boolean;
  page?: number;
  limit?: number;
}

function item(id: string, date: string) {
  return { ...fixture.workouts[0], id, scheduled_date: date, title: `Workout ${id}` };
}

async function setup(pages: unknown[]) {
  const db = await openTestDatabase();
  const schedule = createSqliteScheduleRepository(db);
  const syncState = createSqliteSyncStateRepository(db);
  const calls: Call[] = [];
  const state = { failure: null as ((call: Call) => Error | null) | null, pages };
  const client: LyftaClient = {
    async listWorkouts() {
      return {};
    },
    async listSchedule(call) {
      calls.push(call);
      const error = state.failure?.(call) ?? null;
      if (error) throw error;
      return state.pages[(call.page ?? 1) - 1] ?? { workouts: [] };
    },
    getProfile: async () => ({}),
    getExerciseProgress: async () => ({}),
  };
  const deps = { client, schedule, syncState, now: () => NOW };
  return { deps, schedule, syncState, calls, state };
}

const envelope = (workouts: unknown[], extra: Record<string, unknown> = {}) => ({
  workouts,
  current_page: 1,
  total_pages: 1,
  total_records: workouts.length,
  ...extra,
});

test('scheduleWindow pads a week back and four weeks ahead by one day', () => {
  expect(scheduleWindow('2026-11-12')).toEqual({ from: '2026-11-04', to: '2026-12-11' });
});

test('fetches every page of the window including completed items', async () => {
  const t = await setup([
    envelope([item('a', '2026-11-13')], { current_page: 1, total_pages: 2, total_records: 2 }),
    envelope([item('b', '2026-11-14')], { current_page: 2, total_pages: 2, total_records: 2 }),
  ]);

  expect(await syncLyftaSchedule(t.deps)).toEqual({
    status: 'ok',
    upserted: 2,
    deleted: 0,
    skipped: 0,
  });
  expect(t.calls).toEqual([
    {
      from: '2026-11-04',
      to: '2026-12-11',
      includeCompleted: true,
      page: 1,
      limit: SCHEDULE_PAGE_SIZE,
    },
    {
      from: '2026-11-04',
      to: '2026-12-11',
      includeCompleted: true,
      page: 2,
      limit: SCHEDULE_PAGE_SIZE,
    },
  ]);
  expect(await t.schedule.count()).toBe(2);
});

test('stops after a page with no items even if total_pages says more', async () => {
  const t = await setup([envelope([], { total_pages: 5, total_records: 0 })]);
  expect((await syncLyftaSchedule(t.deps)).status).toBe('ok');
  expect(t.calls).toHaveLength(1);
});

test('replaces the stored window and records success for lyfta_schedule', async () => {
  const t = await setup([envelope([item('a', '2026-11-13')])]);
  await t.schedule.replaceRange(
    '2026-11-04',
    '2026-12-11',
    [{ item: { ...fixtureItem('gone', '2026-11-20') }, rawJson: '{}' }],
    '2026-11-01T00:00:00.000Z',
    false,
  );

  const result = await syncLyftaSchedule(t.deps);

  expect(result).toEqual({ status: 'ok', upserted: 1, deleted: 1, skipped: 0 });
  expect((await t.schedule.listBetween('2026-11-01', '2026-12-31')).map((w) => w.lyftaId)).toEqual([
    'a',
  ]);
  expect(await t.syncState.get('lyfta_schedule')).toMatchObject({
    lastSuccessAt: NOW.toISOString(),
    lastSkipped: 0,
    deletionPause: null,
    lastError: null,
  });
});

function fixtureItem(id: string, date: string) {
  return {
    lyftaId: id,
    date,
    title: 'Old',
    templateId: null,
    source: null,
    status: null,
    completed: false,
  };
}

test('deletes nothing and records the skipped count when an item was skipped', async () => {
  const t = await setup([envelope([item('a', '2026-11-13'), item('bad', 'soon')])]);
  await t.schedule.replaceRange(
    '2026-11-04',
    '2026-12-11',
    [{ item: fixtureItem('old', '2026-11-20'), rawJson: '{}' }],
    '2026-11-01T00:00:00.000Z',
    false,
  );

  expect(await syncLyftaSchedule(t.deps)).toEqual({
    status: 'ok',
    upserted: 1,
    deleted: 0,
    skipped: 1,
  });
  expect(await t.schedule.count()).toBe(2);
  expect((await t.syncState.get('lyfta_schedule')).lastSkipped).toBe(1);
});

test('deletes nothing when a page fails', async () => {
  const t = await setup([
    envelope([item('a', '2026-11-13')], { total_pages: 2, total_records: 2 }),
  ]);
  await t.schedule.replaceRange(
    '2026-11-04',
    '2026-12-11',
    [{ item: fixtureItem('old', '2026-11-20'), rawJson: '{}' }],
    '2026-11-01T00:00:00.000Z',
    false,
  );
  t.state.failure = (call) =>
    call.page === 2 ? new LyftaError('server', 'Lyfta responded with status 500', 500) : null;

  expect(await syncLyftaSchedule(t.deps)).toEqual({
    status: 'error',
    message: 'Lyfta responded with status 500',
  });
  expect((await t.schedule.listBetween('2026-11-01', '2026-12-31')).map((w) => w.lyftaId)).toEqual([
    'old',
  ]);
  expect(await t.syncState.get('lyfta_schedule')).toMatchObject({
    lastSuccessAt: null,
    lastError: 'Lyfta responded with status 500',
  });
});

test('returns invalid_key on 401 and records it', async () => {
  const t = await setup([]);
  t.state.failure = () => new LyftaError('unauthorized', 'Lyfta rejected the API key', 401);

  expect(await syncLyftaSchedule(t.deps)).toEqual({ status: 'invalid_key' });
  expect((await t.syncState.get('lyfta_schedule')).lastError).toBe('invalid_key');
});

test('stops a server that never ends and deletes nothing', async () => {
  const t = await setup([]);
  t.state.pages = [];
  const endless = (call: Call) => ({
    workouts: [item(`n${call.page}`, '2026-11-13')],
    current_page: call.page,
    total_pages: 999,
    total_records: 150,
  });
  t.deps.client.listSchedule = async (call) => {
    t.calls.push(call);
    return endless(call);
  };
  await t.schedule.replaceRange(
    '2026-11-04',
    '2026-12-11',
    [{ item: fixtureItem('old', '2026-11-20'), rawJson: '{}' }],
    '2026-11-01T00:00:00.000Z',
    false,
  );

  expect(await syncLyftaSchedule(t.deps)).toEqual({
    status: 'error',
    message: 'Lyfta returned more pages than expected',
  });
  expect(t.calls).toHaveLength(4);
  expect((await t.schedule.listBetween('2026-11-01', '2026-12-31')).map((w) => w.lyftaId)).toEqual([
    'old',
  ]);
});

test('resolves with an error when recording the failure also fails', async () => {
  const t = await setup([]);
  t.state.failure = () => new Error('boom');
  t.deps.syncState.recordError = async () => {
    throw new Error('db down');
  };
  expect(await syncLyftaSchedule(t.deps)).toEqual({ status: 'error', message: 'boom' });
});
