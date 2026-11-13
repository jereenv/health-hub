import type { HealthConnectAccess } from '@/data/healthconnect/HealthConnectGateway';
import type { SyncState } from '@/data/sync/SyncStateRepository';
import type { HealthConnectConnection } from '@/ui/data/useAppData';

import { describeHealthConnectDetails, describeHealthConnectStatus } from './healthConnectText';
import type { HealthConnectCounts, HealthConnectStatusInput } from './healthConnectText';

const NOW = new Date('2026-11-10T17:00:00Z');
const TWO_MIN_AGO = '2026-11-10T16:58:00Z';
const TWO_H_AGO = '2026-11-10T15:00:00Z';

const EMPTY: SyncState = {
  source: 'health_connect',
  cursor: null,
  lastSuccessAt: null,
  lastError: null,
  lastErrorAt: null,
  lastSkipped: 0,
  deletionPause: null,
};
const FULL_ACCESS: HealthConnectAccess = { readAll: true, history: true, missing: [] };
const COUNTS: HealthConnectCounts = {
  activityDays: 12,
  sleepSessions: 9,
  heartRateDays: 11,
  watchBodyFat: 3,
  weighIns: 7,
};

interface Overrides {
  availability?: HealthConnectConnection['availability'];
  access?: HealthConnectAccess | null;
  state?: Partial<SyncState>;
  running?: boolean;
}

function input({
  availability = 'available',
  access = FULL_ACCESS,
  state,
  running = false,
}: Overrides): HealthConnectStatusInput {
  return {
    connection: { availability, access },
    state: { ...EMPTY, ...state },
    running,
    now: NOW,
  };
}

test.each<[string, Overrides, string, string]>([
  [
    'not installed',
    { availability: 'not_installed', access: null },
    'Install Health Connect',
    'warning',
  ],
  [
    'update required',
    { availability: 'update_required', access: null },
    'Update Health Connect',
    'warning',
  ],
  [
    'unavailable',
    { availability: 'unavailable', access: null },
    "Health Connect isn't available",
    'warning',
  ],
  ['access unknown', { access: null }, 'Not connected', 'warning'],
  [
    'a partial grant',
    { access: { readAll: false, history: false, missing: ['Steps'] } },
    'Not connected',
    'warning',
  ],
  ['running', { running: true }, 'Syncing…', 'muted'],
  [
    'failure',
    { state: { lastError: 'boom', lastErrorAt: TWO_H_AGO } },
    'Sync failed 2 h ago',
    'warning',
  ],
  ['failure without a time', { state: { lastError: 'boom' } }, 'Sync failed', 'warning'],
  [
    'history off',
    {
      access: { readAll: true, history: false, missing: [] },
      state: { lastSuccessAt: TWO_MIN_AGO },
    },
    'Connected · last 30 days only',
    'warning',
  ],
  ['synced', { state: { lastSuccessAt: TWO_MIN_AGO } }, 'Synced 2 min ago', 'muted'],
  ['never synced', {}, 'Not synced yet', 'muted'],
])('status line: %s', (_name, overrides, text, tone) => {
  expect(describeHealthConnectStatus(input(overrides))).toEqual({ text, tone });
});

test('an error outranks the history warning and a running sync outranks an error', () => {
  const noHistory = { readAll: true, history: false, missing: [] };
  const failed = { lastError: 'boom', lastErrorAt: TWO_H_AGO };
  expect(describeHealthConnectStatus(input({ access: noHistory, state: failed })).text).toBe(
    'Sync failed 2 h ago',
  );
  expect(
    describeHealthConnectStatus(input({ access: noHistory, state: failed, running: true })).text,
  ).toBe('Syncing…');
});

test('availability outranks a running sync, and a missing grant outranks running', () => {
  expect(
    describeHealthConnectStatus(
      input({ availability: 'not_installed', access: null, running: true }),
    ).text,
  ).toBe('Install Health Connect');
  expect(
    describeHealthConnectStatus(
      input({ access: { readAll: false, history: true, missing: ['Steps'] }, running: true }),
    ).text,
  ).toBe('Not connected');
});

test('relative ages use formatRelativeTime', () => {
  expect(
    describeHealthConnectStatus(input({ state: { lastSuccessAt: '2026-11-09T12:00:00Z' } })).text,
  ).toBe('Synced yesterday');
  expect(
    describeHealthConnectStatus(input({ state: { lastSuccessAt: '2026-11-10T16:59:40Z' } })).text,
  ).toBe('Synced just now');
});

function details(overrides: Overrides, counts: HealthConnectCounts = COUNTS): string[] {
  return describeHealthConnectDetails({ ...input(overrides), counts }).map((line) => line.text);
}

test('details list the last sync, the last error and the counts', () => {
  expect(
    details({
      state: { lastSuccessAt: TWO_MIN_AGO, lastError: 'boom', lastErrorAt: TWO_H_AGO },
    }),
  ).toEqual([
    'Last synced 2 min ago',
    'Last error 2 h ago: boom',
    '12 days of activity · 9 nights of sleep · 7 weigh-ins from MovingLife · 3 watch body-fat checks',
  ]);
});

test('details list counts with correct singular and plural', () => {
  const one = { activityDays: 1, sleepSessions: 1, heartRateDays: 1, watchBodyFat: 1, weighIns: 1 };
  expect(details({}, one)).toEqual([
    '1 day of activity · 1 night of sleep · 1 weigh-in from MovingLife · 1 watch body-fat check',
  ]);
  const none = {
    activityDays: 0,
    sleepSessions: 0,
    heartRateDays: 0,
    watchBodyFat: 0,
    weighIns: 0,
  };
  expect(details({}, none)).toEqual([
    '0 days of activity · 0 nights of sleep · 0 weigh-ins from MovingLife · 0 watch body-fat checks',
  ]);
});

test('history off adds the past-data hint', () => {
  const lines = describeHealthConnectDetails({
    ...input({ access: { readAll: true, history: false, missing: [] } }),
    counts: COUNTS,
  });
  expect(lines[lines.length - 1]).toEqual({
    text: "Allow 'Access past data' to import everything.",
    tone: 'warning',
  });
  expect(details({})).not.toContain("Allow 'Access past data' to import everything.");
});
