import type { SyncStateRepository } from '@/data/sync/SyncStateRepository';
import { localDateKey } from '@/domain/time/localDate';
import type { DateKey } from '@/domain/time/localDate';

import { CHUNK_DAYS } from './constants';
import type {
  DailyKind,
  HealthConnectAvailability,
  HealthConnectGateway,
} from './HealthConnectGateway';
import type {
  ActivityDay,
  HealthConnectRepository,
  HeartRateDay,
  SleepSessionRow,
} from './HealthConnectRepository';
import { chunkRange, parseCursor, planImport } from './importWindow';
import type { HealthConnectCursor } from './importWindow';
import { summariseSleep } from './sleepSummary';
import { buildWeighIns } from './weighIns';

const SOURCE = 'health_connect';

export type HealthConnectNotConnectedReason =
  Exclude<HealthConnectAvailability, 'available'> | 'no_permission';

export type HealthConnectSyncResult =
  | { status: 'not_connected'; reason: HealthConnectNotConnectedReason }
  | {
      status: 'ok';
      mode: 'full' | 'incremental';
      from: DateKey;
      activityDays: number;
      sleepSessions: number;
      heartRateDays: number;
      weighIns: number;
      watchBodyFat: number;
      ignored: number;
    }
  | { status: 'error'; message: string };

export interface HealthConnectSyncDeps {
  gateway: HealthConnectGateway;
  repository: HealthConnectRepository;
  syncState: SyncStateRepository;
  now: () => Date;
}

const ACTIVITY_FIELD = {
  steps: 'steps',
  distanceM: 'distanceM',
  activeKcal: 'activeKcal',
  totalKcal: 'totalKcal',
} as const satisfies Record<DailyKind, keyof ActivityDay>;

function messageOf(error: unknown): string {
  return error instanceof Error && error.message !== ''
    ? error.message
    : 'Health Connect sync failed';
}

/**
 * Imports Health Connect data. Re-reads a trailing window of daily data (everything on a first run
 * or when history access is newly granted) and always rebuilds weigh-ins, so edits and deletions
 * inside the window are picked up. The cursor is saved last, so a failure changes nothing. Never
 * throws.
 */
export async function syncHealthConnect(
  deps: HealthConnectSyncDeps,
): Promise<HealthConnectSyncResult> {
  const { gateway, repository, syncState } = deps;
  const now = deps.now();
  try {
    const availability = await gateway.availability();
    if (availability !== 'available') return { status: 'not_connected', reason: availability };
    const access = await gateway.getAccess();
    if (!access.readAll) return { status: 'not_connected', reason: 'no_permission' };

    const today = localDateKey(now);
    const cursor = parseCursor((await syncState.get(SOURCE)).cursor);
    const needsFull = cursor === null || (access.history && !cursor.history);
    const earliest = needsFull ? await gateway.earliestDate() : null;
    const plan = planImport({ cursor, historyGranted: access.history, today, earliest });

    const activity = new Map<DateKey, ActivityDay>();
    const heartRate = new Map<DateKey, HeartRateDay>();
    const sleep = new Map<string, SleepSessionRow>();
    for (const range of chunkRange(plan.range, CHUNK_DAYS)) {
      for (const kind of Object.keys(ACTIVITY_FIELD) as DailyKind[]) {
        for (const { date, value } of await gateway.dailyValues(kind, range)) {
          const day = activity.get(date) ?? {
            date,
            steps: null,
            distanceM: null,
            activeKcal: null,
            totalKcal: null,
          };
          day[ACTIVITY_FIELD[kind]] = value;
          activity.set(date, day);
        }
      }
      for (const day of await gateway.dailyHeartRate(range)) heartRate.set(day.date, day);
      for (const record of await gateway.sleepRecords(range)) {
        const row = summariseSleep(record);
        if (row !== null) sleep.set(row.hcId, row);
      }
    }

    const weighIns = buildWeighIns(
      await gateway.bodyRecords('weight'),
      await gateway.bodyRecords('bodyFat'),
    );

    const syncedAt = now.toISOString();
    await repository.applyImport({
      from: plan.range.from,
      activity: [...activity.values()],
      sleep: [...sleep.values()],
      heartRate: [...heartRate.values()],
      watchBodyFat: weighIns.watchBodyFat,
      weighIns: weighIns.weighIns,
      syncedAt,
    });

    const saved: HealthConnectCursor = { v: 1, syncedThrough: today, history: access.history };
    await syncState.recordSuccess(SOURCE, syncedAt, JSON.stringify(saved));

    return {
      status: 'ok',
      mode: plan.mode,
      from: plan.range.from,
      activityDays: activity.size,
      sleepSessions: sleep.size,
      heartRateDays: heartRate.size,
      weighIns: weighIns.weighIns.length,
      watchBodyFat: weighIns.watchBodyFat.length,
      ignored: weighIns.ignored,
    };
  } catch (error) {
    const message = messageOf(error);
    try {
      await syncState.recordError(SOURCE, message, now.toISOString());
    } catch {
      // Bookkeeping failed; the caller still gets the error.
    }
    return { status: 'error', message };
  }
}
