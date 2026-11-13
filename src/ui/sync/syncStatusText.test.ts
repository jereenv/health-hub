import type { SyncState } from '@/data/sync/SyncStateRepository';

import { describeSyncDetails, describeSyncStatus } from './syncStatusText';
import type { SyncStatusInput } from './syncStatusText';

const NOW = new Date('2026-11-10T17:00:00Z');
const TWO_MIN_AGO = '2026-11-10T16:58:00Z';
const TWO_H_AGO = '2026-11-10T15:00:00Z';

const EMPTY: SyncState = {
  source: 'lyfta',
  cursor: null,
  lastSuccessAt: null,
  lastError: null,
  lastErrorAt: null,
  lastSkipped: 0,
  deletionPause: null,
};

type Overrides = Partial<Omit<SyncStatusInput, 'state'>> & { state?: Partial<SyncState> };

function input({ state, ...rest }: Overrides): SyncStatusInput {
  return {
    state: { ...EMPTY, ...state },
    running: false,
    hasKey: true,
    now: NOW,
    noun: 'workout',
    ...rest,
  };
}

const PAUSE = { reason: 'unreadable' as const, candidateIds: [7], skipped: 2, pausedAt: TWO_H_AGO };

test.each<[string, Overrides, string, string]>([
  ['no key', { hasKey: false }, 'Lyfta not connected', 'warning'],
  ['running', { running: true }, 'Syncing…', 'muted'],
  ['invalid key', { state: { lastError: 'invalid_key' } }, 'Lyfta rejected the key', 'warning'],
  [
    'failure',
    {
      state: {
        lastError: 'Could not reach Lyfta (network error or timeout)',
        lastErrorAt: TWO_H_AGO,
      },
    },
    'Sync failed 2 h ago',
    'warning',
  ],
  [
    'paused',
    { state: { lastSuccessAt: TWO_MIN_AGO, deletionPause: PAUSE } },
    "2 workouts couldn't be read · deletions paused",
    'warning',
  ],
  [
    'check failed',
    { state: { lastSuccessAt: TWO_MIN_AGO, deletionPause: { ...PAUSE, reason: 'error' } } },
    'Deletion check failed · retrying next sync',
    'warning',
  ],
  [
    'skipped',
    { state: { lastSuccessAt: TWO_MIN_AGO, lastSkipped: 1 }, noun: 'scheduled workout' },
    "1 scheduled workout couldn't be read",
    'warning',
  ],
  ['ok', { state: { lastSuccessAt: TWO_MIN_AGO } }, 'Synced 2 min ago', 'muted'],
  ['never', {}, 'Not synced yet', 'muted'],
])('describeSyncStatus: %s', (_name, overrides, text, tone) => {
  expect(describeSyncStatus(input(overrides))).toEqual({ text, tone });
});

test('describeSyncDetails lists last success, last error and the pause reason', () => {
  const lines = describeSyncDetails(
    input({
      state: {
        lastSuccessAt: TWO_MIN_AGO,
        lastError: 'Could not reach Lyfta (network error or timeout)',
        lastErrorAt: TWO_H_AGO,
        deletionPause: PAUSE,
      },
    }),
  );
  expect(lines.map((line) => line.text)).toEqual([
    'Last synced 2 min ago',
    'Last error 2 h ago: Could not reach Lyfta (network error or timeout)',
    "Deletions from Lyfta are paused: 2 workouts there can't be read. Re-sync downloads your workouts again and tries to read these.",
  ]);
  expect(lines.map((line) => line.tone)).toEqual(['muted', 'warning', 'warning']);
});

test('describeSyncDetails explains a failed deletion check', () => {
  const lines = describeSyncDetails(
    input({ state: { deletionPause: { ...PAUSE, reason: 'error' } } }),
  );
  expect(lines.map((line) => line.text)).toEqual([
    'Deletions from Lyfta are paused: the last check failed. It retries on the next sync.',
  ]);
});

test('describeSyncDetails says so when nothing has synced', () => {
  expect(describeSyncDetails(input({}))).toEqual([{ text: 'Not synced yet', tone: 'muted' }]);
});
