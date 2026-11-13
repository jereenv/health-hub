// Throwaway: summaries for the Task 22 probe. Counts, origins and dates only; never a value.
import { z } from 'zod';

import { localDateKey } from '@/domain/time/localDate';
import type { DateKey } from '@/domain/time/localDate';

import { WEIGH_IN_WINDOW_MS } from './constants';

const UNKNOWN_ORIGIN = 'unknown';
const SAME_TIME_MS = 2_000;

const recordSchema = z.object({
  metadata: z
    .object({
      dataOrigin: z.string().optional(),
      lastModifiedTime: z.string().optional(),
    })
    .optional(),
  time: z.string().optional(),
});

export interface OriginSummary {
  count: number;
  earliest: DateKey | null;
  latest: DateKey | null;
}

export interface BodyProbe {
  origin: string;
  count: number;
  timeEqLastModified: number;
  batchedWrites: number;
  daysWithOne: number;
  daysWithTwo: number;
  daysWithThreePlus: number;
  pairsTimeWindow: number;
  pairsSameDay: number;
  hourHistogram: number[];
}

/** The instant of an ISO string with a zone, or null when it is missing or unparseable. */
function parseInstant(value: string | undefined): Date | null {
  if (value === undefined) return null;
  try {
    localDateKey(value);
  } catch {
    return null;
  }
  return new Date(value);
}

function originOf(record: unknown): string {
  const parsed = recordSchema.safeParse(record);
  return (parsed.success && parsed.data.metadata?.dataOrigin) || UNKNOWN_ORIGIN;
}

/** The `time` field of an instantaneous record (Weight, BodyFat), or null. */
export function instantTimeOf(record: unknown): string | null {
  const parsed = recordSchema.safeParse(record);
  return parsed.success ? (parsed.data.time ?? null) : null;
}

export function summariseByOrigin(
  records: readonly unknown[],
  timeOf: (r: unknown) => string | null,
): Record<string, OriginSummary> {
  const summaries: Record<string, OriginSummary> = {};
  for (const record of records) {
    const instant = parseInstant(timeOf(record) ?? undefined);
    if (instant === null) continue;
    const day = localDateKey(instant);
    const origin = originOf(record);
    const summary = (summaries[origin] ??= { count: 0, earliest: null, latest: null });
    summary.count += 1;
    if (summary.earliest === null || day < summary.earliest) summary.earliest = day;
    if (summary.latest === null || day > summary.latest) summary.latest = day;
  }
  return summaries;
}

interface TimedRecord {
  time: Date;
  lastModified: Date | null;
}

export function summariseBodyRecords(records: readonly unknown[], origin: string): BodyProbe {
  const timed: TimedRecord[] = [];
  for (const record of records) {
    if (originOf(record) !== origin) continue;
    const parsed = recordSchema.safeParse(record);
    if (!parsed.success) continue;
    const time = parseInstant(parsed.data.time);
    if (time === null) continue;
    timed.push({ time, lastModified: parseInstant(parsed.data.metadata?.lastModifiedTime) });
  }
  timed.sort((a, b) => a.time.getTime() - b.time.getTime());

  const timeEqLastModified = timed.filter(
    (r) =>
      r.lastModified !== null &&
      Math.abs(r.time.getTime() - r.lastModified.getTime()) <= SAME_TIME_MS,
  ).length;

  const bySecond = new Map<number, TimedRecord[]>();
  for (const r of timed) {
    if (r.lastModified === null) continue;
    const second = Math.floor(r.lastModified.getTime() / 1000);
    bySecond.set(second, [...(bySecond.get(second) ?? []), r]);
  }
  let batchedWrites = 0;
  for (const group of bySecond.values()) {
    batchedWrites += group.filter((r) =>
      group.some((other) => Math.abs(other.time.getTime() - r.time.getTime()) > WEIGH_IN_WINDOW_MS),
    ).length;
  }

  const perDay = new Map<DateKey, number>();
  const hourHistogram = new Array<number>(24).fill(0);
  for (const r of timed) {
    const day = localDateKey(r.time);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
    hourHistogram[r.time.getHours()] += 1;
  }
  const dayCounts = [...perDay.values()];

  let pairsTimeWindow = 0;
  let pairsSameDay = 0;
  for (let i = 0; i + 1 < timed.length; i += 1) {
    const a = timed[i]!.time;
    const b = timed[i + 1]!.time;
    if (b.getTime() - a.getTime() <= WEIGH_IN_WINDOW_MS) pairsTimeWindow += 1;
    if (localDateKey(a) === localDateKey(b)) pairsSameDay += 1;
  }

  return {
    origin,
    count: timed.length,
    timeEqLastModified,
    batchedWrites,
    daysWithOne: dayCounts.filter((n) => n === 1).length,
    daysWithTwo: dayCounts.filter((n) => n === 2).length,
    daysWithThreePlus: dayCounts.filter((n) => n >= 3).length,
    pairsTimeWindow,
    pairsSameDay,
    hourHistogram,
  };
}
