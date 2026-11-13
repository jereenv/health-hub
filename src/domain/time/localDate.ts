/** A calendar day, 'YYYY-MM-DD', in the phone's time zone. It is not a timestamp. */
export type DateKey = string;

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ZONE_SUFFIX_PATTERN = /(Z|[+-]\d{2}:\d{2})$/;
const MS_PER_DAY = 86_400_000;

interface DateParts {
  year: number;
  month: number; // 1-12
  day: number;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

/** Midnight UTC of the calendar day. UTC has no DST, so day maths on it is exact. */
function utcMs(parts: DateParts): number {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  return date.getTime();
}

function partsFromUtcMs(ms: number): DateParts {
  const date = new Date(ms);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function keyFromParts(parts: DateParts): DateKey {
  return `${pad(parts.year, 4)}-${pad(parts.month, 2)}-${pad(parts.day, 2)}`;
}

export function isDateKey(value: string): boolean {
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return keyFromParts(partsFromUtcMs(utcMs(parts))) === value;
}

/** Splits a DateKey into numbers. Throws on anything that is not a real calendar date. */
export function parseDateKey(key: DateKey): DateParts {
  if (!isDateKey(key)) throw new RangeError(`Invalid DateKey: ${key}`);
  const [year, month, day] = key.split('-').map(Number) as [number, number, number];
  return { year, month, day };
}

/**
 * The phone-local calendar day of an instant. A string must be our own normalised
 * ISO UTC string; never pass raw Lyfta strings here. A string without `Z` or `±hh:mm` would be
 * read in the device zone by the engine, so it is rejected.
 */
export function localDateKey(instant: Date | string): DateKey {
  if (typeof instant === 'string' && !ZONE_SUFFIX_PATTERN.test(instant)) {
    throw new RangeError('Instant string must end in Z or an offset');
  }
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid instant');
  return keyFromParts({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  });
}

export function addDays(key: DateKey, days: number): DateKey {
  return keyFromParts(partsFromUtcMs(utcMs(parseDateKey(key)) + days * MS_PER_DAY));
}

export function daysBetween(from: DateKey, to: DateKey): number {
  return Math.round((utcMs(parseDateKey(to)) - utcMs(parseDateKey(from))) / MS_PER_DAY);
}

/** 0 = Monday ... 6 = Sunday. */
export function weekdayIndex(key: DateKey): number {
  return (new Date(utcMs(parseDateKey(key))).getUTCDay() + 6) % 7;
}

export function weekStartKey(key: DateKey): DateKey {
  return addDays(key, -weekdayIndex(key));
}

export function monthStartKey(key: DateKey): DateKey {
  const { year, month } = parseDateKey(key);
  return keyFromParts({ year, month, day: 1 });
}

/** Whole years completed on `on`. */
export function ageOn(birth: DateKey, on: DateKey): number {
  const b = parseDateKey(birth);
  const o = parseDateKey(on);
  const hadBirthday = o.month > b.month || (o.month === b.month && o.day >= b.day);
  return o.year - b.year - (hadBirthday ? 0 : 1);
}
