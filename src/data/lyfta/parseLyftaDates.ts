import type { DateKey } from '@/domain/time/localDate';
import { isDateKey } from '@/domain/time/localDate';

const DATETIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/;
const DATE_PREFIX_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:[T ].*)?$/;
const OFFSET_PATTERN = /^([+-])(\d{2}):(\d{2})$/;
const MIN_YEAR = 1900;

interface DateTimeParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

/** Whether the calendar day and clock time are real (rejects Feb 30, hour 24, minute 60 ...). */
function isRealDateTime(p: DateTimeParts): boolean {
  if (p.year < MIN_YEAR || p.hour > 23 || p.minute > 59 || p.second > 59) return false;
  const check = new Date(Date.UTC(p.year, p.month - 1, p.day));
  return (
    check.getUTCFullYear() === p.year &&
    check.getUTCMonth() === p.month - 1 &&
    check.getUTCDate() === p.day
  );
}

/** Milliseconds to subtract from a wall-clock reading to get UTC, or null if the offset is bad. */
function offsetMs(zone: string): number | null {
  if (zone === 'Z') return 0;
  const match = OFFSET_PATTERN.exec(zone);
  if (!match) return null;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (hours > 23 || minutes > 59) return null;
  const magnitude = (hours * 60 + minutes) * 60_000;
  return match[1] === '-' ? -magnitude : magnitude;
}

const DAY_MS = 86_400_000;

/** The local wall-clock fields of an instant, encoded as UTC milliseconds (see `Date.UTC`). */
export type LocalWallReader = (instantMs: number) => number;

/** Reads the device-zone wall clock of an instant using only the engine's field getters. */
const readDeviceWall: LocalWallReader = (instantMs) => {
  const d = new Date(instantMs);
  return Date.UTC(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  );
};

/**
 * Finds the instant at which a zone's wall clock reads `wallMs` (the wanted fields encoded with
 * `Date.UTC`), without relying on how the engine resolves non-existent or ambiguous local times.
 * It samples the zone's UTC offset a day either side, keeps each candidate instant that reads back
 * as exactly the wanted wall time, and applies our rule:
 * - Ambiguous (fall-back overlap, two candidates): the earlier, first occurrence.
 * - Non-existent (spring-forward gap, no candidate): the pre-transition offset is applied, which
 *   moves the time forward by the length of the gap.
 */
export function resolveLocalWallTime(wallMs: number, readWall: LocalWallReader): number {
  const offsetAt = (instantMs: number): number => readWall(instantMs) - instantMs;
  const before = offsetAt(wallMs - DAY_MS);
  const after = offsetAt(wallMs + DAY_MS);
  const valid = [before, after]
    .map((offset) => wallMs - offset)
    .filter((candidate) => readWall(candidate) === wallMs);
  return valid.length > 0 ? Math.min(...valid) : wallMs - before;
}

/**
 * Turns a Lyfta datetime into our normalised ISO UTC string, without ever handing the string to
 * the engine's date parser. Accepts `YYYY-MM-DD[T ]HH:mm[:ss[.fff]]` with an optional `Z` or
 * `±hh:mm`.
 *
 * Lyfta's `workout_perform_date` has no zone; it is the owner's local wall-clock time, so a
 * zoneless value is read as local time in the device zone (DST-aware). The result is checked by
 * reading the wall clock back (`resolveLocalWallTime`), so daylight-saving edges follow this rule
 * whatever the JS engine does:
 * - A non-existent local time (the spring-forward gap, e.g. 2026-03-08 02:30 in New York) moves
 *   forward by the length of the gap (to 03:30 local, 07:30Z).
 * - An ambiguous local time (the fall-back overlap, e.g. 2026-11-01 01:30) takes the earlier,
 *   first occurrence (daylight time, 05:30Z).
 *
 * Returns null for anything that is not a real date and time.
 */
export function parseLyftaInstant(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = DATETIME_PATTERN.exec(value.trim());
  if (!match) return null;

  const parts: DateTimeParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: match[6] === undefined ? 0 : Number(match[6]),
    millisecond: match[7] === undefined ? 0 : Number(match[7].padEnd(3, '0')),
  };
  if (!isRealDateTime(parts)) return null;

  const zone = match[8];
  let instantMs: number;
  if (zone === undefined) {
    instantMs = resolveLocalWallTime(
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
        parts.millisecond,
      ),
      readDeviceWall,
    );
  } else {
    const offset = offsetMs(zone);
    if (offset === null) return null;
    instantMs =
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
        parts.millisecond,
      ) - offset;
  }
  return Number.isNaN(instantMs) ? null : new Date(instantMs).toISOString();
}

/**
 * The calendar date part of a Lyfta date or datetime (`YYYY-MM-DD`, optionally followed by a time),
 * taken as written with no zone conversion. Null if it is not a real calendar date.
 */
export function parseLyftaDate(value: unknown): DateKey | null {
  if (typeof value !== 'string') return null;
  const match = DATE_PREFIX_PATTERN.exec(value.trim());
  if (!match) return null;
  return isDateKey(match[1]) ? match[1] : null;
}
