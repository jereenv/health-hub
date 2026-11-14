import type { SleepSessionRow } from '@/data/healthconnect/HealthConnectRepository';
import type { DateKey } from '@/domain/time/localDate';

export interface SleepNight {
  date: DateKey;
  asleepS: number;
  awakeS: number;
  lightS: number | null;
  deepS: number | null;
  remS: number | null;
  /** ISO UTC start of the earliest session. */
  bedtime: string;
  /** ISO UTC end of the latest session. */
  wakeTime: string;
}

export interface SleepConsistency {
  /** Minutes after local midnight. */
  averageBedtimeMin: number;
  averageWakeMin: number;
  bedtimeSpreadMin: number;
  nights: number;
}

const MINUTES_PER_DAY = 1440;
/** Bedtimes are measured from 18:00 so 23:30 and 00:30 are an hour apart, not 23. */
const BEDTIME_ORIGIN_MIN = 18 * 60;
const MIN_NIGHTS = 3;

/** Sessions closer together than this belong to one night; a longer gap is a nap. */
const MAX_BLOCK_GAP_MS = 3 * 60 * 60 * 1000;

interface SleepBlock {
  startMs: number;
  endMs: number;
  startAt: string;
  endAt: string;
}

/**
 * The night itself: sessions are chained into blocks (a session joins the current block when it
 * starts less than 3 hours after the block's latest end) and the block with the longest span wins,
 * the earlier one on a tie. A night split by a short wake is one block; a daytime nap is another.
 */
function mainBlock(group: readonly SleepSessionRow[]): SleepBlock {
  const sorted = [...group].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  const blocks: SleepBlock[] = [];
  for (const session of sorted) {
    const startMs = Date.parse(session.startAt);
    const endMs = Date.parse(session.endAt);
    const current = blocks[blocks.length - 1];
    if (current && startMs - current.endMs < MAX_BLOCK_GAP_MS) {
      if (endMs > current.endMs) {
        current.endMs = endMs;
        current.endAt = session.endAt;
      }
    } else {
      blocks.push({ startMs, endMs, startAt: session.startAt, endAt: session.endAt });
    }
  }
  return blocks.reduce((best, block) =>
    block.endMs - block.startMs > best.endMs - best.startMs ? block : best,
  );
}

/**
 * One night per wake date, ascending. Sessions ending the same day (naps included) are summed for
 * asleep time and stages; bedtime and wake time come from the main block (see `mainBlock`), so a
 * nap does not move them and a split night keeps its real wake.
 */
export function buildSleepNights(sessions: readonly SleepSessionRow[]): SleepNight[] {
  const groups = new Map<DateKey, SleepSessionRow[]>();
  for (const session of sessions) {
    const group = groups.get(session.wakeDate);
    if (group) group.push(session);
    else groups.set(session.wakeDate, [session]);
  }

  return [...groups.keys()].sort().map((date) => {
    const group = groups.get(date)!;
    const main = mainBlock(group);
    const staged = group.filter((s) => s.hasStages);
    const stageSum = (pick: (s: SleepSessionRow) => number | null): number | null =>
      staged.length === 0 ? null : staged.reduce((sum, s) => sum + (pick(s) ?? 0), 0);
    return {
      date,
      asleepS: group.reduce((sum, s) => sum + s.asleepS, 0),
      awakeS: group.reduce((sum, s) => sum + s.awakeS, 0),
      lightS: stageSum((s) => s.lightS),
      deepS: stageSum((s) => s.deepS),
      remS: stageSum((s) => s.remS),
      bedtime: main.startAt,
      wakeTime: main.endAt,
    };
  });
}

function localMinutes(iso: string): number {
  const date = new Date(iso);
  return date.getHours() * 60 + date.getMinutes();
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Null under three nights: a spread of two points says nothing. */
export function sleepConsistency(nights: readonly SleepNight[]): SleepConsistency | null {
  if (nights.length < MIN_NIGHTS) return null;
  const sinceOrigin = nights.map(
    (n) => (localMinutes(n.bedtime) - BEDTIME_ORIGIN_MIN + MINUTES_PER_DAY) % MINUTES_PER_DAY,
  );
  const average = mean(sinceOrigin);
  const variance = mean(sinceOrigin.map((m) => (m - average) ** 2));
  return {
    averageBedtimeMin: Math.round(average + BEDTIME_ORIGIN_MIN) % MINUTES_PER_DAY,
    averageWakeMin: Math.round(mean(nights.map((n) => localMinutes(n.wakeTime)))),
    bedtimeSpreadMin: Math.round(Math.sqrt(variance)),
    nights: nights.length,
  };
}

/** Mean asleep seconds, null with no nights. */
export function averageAsleepS(nights: readonly SleepNight[]): number | null {
  return nights.length === 0 ? null : mean(nights.map((n) => n.asleepS));
}

/** Minutes after local midnight as '23:40'; wraps past midnight. */
export function formatClock(minutes: number): string {
  const wrapped = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(wrapped / 60);
  return `${String(hours).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}
