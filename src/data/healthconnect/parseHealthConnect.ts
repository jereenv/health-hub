import { z } from 'zod';

import { isDateKey } from '@/domain/time/localDate';
import type { DateKey } from '@/domain/time/localDate';

import type {
  BodyRecord,
  DailyHeartRate,
  DailyKind,
  DailyValue,
  SleepRecord,
  SleepStageName,
} from './HealthConnectGateway';

export interface Parsed<T> {
  items: T[];
  rejected: number;
}

const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$/;

/** Normalises an ISO string with a zone to an ISO UTC string; null for anything else. */
function toIsoUtc(value: unknown): string | null {
  if (typeof value !== 'string' || !ISO_WITH_ZONE.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Every field is optional until checked: library results are never trusted by type alone. */
const looseObject = z.record(z.string(), z.unknown());

function objectOf(value: unknown): Record<string, unknown> | null {
  const parsed = looseObject.safeParse(value);
  return parsed.success && !Array.isArray(value) ? parsed.data : null;
}

function listOf(raw: unknown): unknown[] {
  return Array.isArray(raw) ? raw : [];
}

type GroupOutcome<T> = { kind: 'item'; item: T } | { kind: 'empty' } | { kind: 'rejected' };

/**
 * Reads one aggregation group. A group whose `dataOrigins` is missing or empty is "no data" and
 * yields `empty`, which is not an error and never becomes a zero.
 */
function readGroup(
  group: unknown,
): { date: DateKey; result: Record<string, unknown> } | 'empty' | 'rejected' {
  const g = objectOf(group);
  if (g === null) return 'rejected';
  const result = objectOf(g['result']);
  const origins = result === null ? undefined : result['dataOrigins'];
  if (result === null || !Array.isArray(origins) || origins.length === 0) return 'empty';
  const startTime = g['startTime'];
  if (typeof startTime !== 'string') return 'rejected';
  const date = startTime.slice(0, 10);
  if (!isDateKey(date)) return 'rejected';
  return { date, result };
}

function collect<T>(raw: unknown, read: (group: unknown) => GroupOutcome<T>): Parsed<T> {
  const items: T[] = [];
  let rejected = 0;
  for (const group of listOf(raw)) {
    const outcome = read(group);
    if (outcome.kind === 'item') items.push(outcome.item);
    else if (outcome.kind === 'rejected') rejected += 1;
  }
  return { items, rejected };
}

function dailyAmount(kind: DailyKind, result: Record<string, unknown>): number | null {
  switch (kind) {
    case 'steps': {
      const count = finiteNumber(result['COUNT_TOTAL']);
      return count === null ? null : Math.round(count);
    }
    case 'distanceM':
      return finiteNumber(objectOf(result['DISTANCE'])?.['inMeters']);
    case 'activeKcal':
      return finiteNumber(objectOf(result['ACTIVE_CALORIES_TOTAL'])?.['inKilocalories']);
    case 'totalKcal':
      return finiteNumber(objectOf(result['ENERGY_TOTAL'])?.['inKilocalories']);
  }
}

export function parseDailyValues(kind: DailyKind, raw: unknown): Parsed<DailyValue> {
  return collect<DailyValue>(raw, (group) => {
    const read = readGroup(group);
    if (read === 'empty') return { kind: 'empty' };
    if (read === 'rejected') return { kind: 'rejected' };
    const value = dailyAmount(kind, read.result);
    if (value === null || value < 0) return { kind: 'rejected' };
    return { kind: 'item', item: { date: read.date, value } };
  });
}

export function parseDailyHeartRate(raw: unknown): Parsed<DailyHeartRate> {
  return collect<DailyHeartRate>(raw, (group) => {
    const read = readGroup(group);
    if (read === 'empty') return { kind: 'empty' };
    if (read === 'rejected') return { kind: 'rejected' };
    const min = finiteNumber(read.result['BPM_MIN']);
    const avg = finiteNumber(read.result['BPM_AVG']);
    const max = finiteNumber(read.result['BPM_MAX']);
    if (min === null || avg === null || max === null || min < 0 || avg < 0 || max < 0) {
      return { kind: 'rejected' };
    }
    return {
      kind: 'item',
      item: {
        date: read.date,
        minBpm: Math.round(min),
        avgBpm: Math.round(avg * 10) / 10,
        maxBpm: Math.round(max),
      },
    };
  });
}

// The library's SleepStageType constant: 0 unknown, 1 awake, 2 sleeping, 3 out of bed,
// 4 light, 5 deep, 6 REM.
const STAGE_NAMES: Record<number, SleepStageName> = {
  1: 'awake',
  2: 'asleep',
  3: 'out_of_bed',
  4: 'light',
  5: 'deep',
  6: 'rem',
};

function parseStages(raw: unknown): SleepRecord['stages'] {
  const stages: SleepRecord['stages'] = [];
  for (const entry of listOf(raw)) {
    const stage = objectOf(entry);
    if (stage === null) continue;
    const startAt = toIsoUtc(stage['startTime']);
    const endAt = toIsoUtc(stage['endTime']);
    if (startAt === null || endAt === null) continue;
    const code = finiteNumber(stage['stage']);
    stages.push({ stage: (code !== null && STAGE_NAMES[code]) || 'unknown', startAt, endAt });
  }
  return stages;
}

export function parseSleepRecords(raw: unknown): Parsed<SleepRecord> {
  const items: SleepRecord[] = [];
  let rejected = 0;
  for (const entry of listOf(raw)) {
    const record = objectOf(entry);
    const id = objectOf(record?.['metadata'])?.['id'];
    const startAt = toIsoUtc(record?.['startTime']);
    const endAt = toIsoUtc(record?.['endTime']);
    if (
      record === null ||
      typeof id !== 'string' ||
      id === '' ||
      startAt === null ||
      endAt === null
    ) {
      rejected += 1;
      continue;
    }
    items.push({ hcId: id, startAt, endAt, stages: parseStages(record['stages']) });
  }
  return { items, rejected };
}

export function parseBodyRecords(kind: 'weight' | 'bodyFat', raw: unknown): Parsed<BodyRecord> {
  const items: BodyRecord[] = [];
  let rejected = 0;
  for (const entry of listOf(raw)) {
    const record = objectOf(entry);
    const metadata = objectOf(record?.['metadata']);
    const id = metadata?.['id'];
    const time = toIsoUtc(record?.['time']);
    const value =
      kind === 'weight'
        ? finiteNumber(objectOf(record?.['weight'])?.['inKilograms'])
        : finiteNumber(record?.['percentage']);
    if (typeof id !== 'string' || id === '' || time === null || value === null) {
      rejected += 1;
      continue;
    }
    const origin = metadata?.['dataOrigin'];
    items.push({ hcId: id, time, origin: typeof origin === 'string' ? origin : '', value });
  }
  return { items, rejected };
}

/** The local-zone-free start of the first record of a one-record read, or null. */
export function parseFirstStartTime(raw: unknown): string | null {
  const record = objectOf(listOf(raw)[0]);
  return toIsoUtc(record?.['startTime']);
}
