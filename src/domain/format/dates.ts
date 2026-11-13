import {
  addDays,
  daysBetween,
  localDateKey,
  parseDateKey,
  weekdayIndex,
  type DateKey,
} from '@/domain/time/localDate';

// Fixed English names, not Intl, so Hermes and Node produce identical output.
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function weekdayShort(key: DateKey): string {
  return WEEKDAYS[weekdayIndex(key)]!.slice(0, 3);
}

function monthLong(key: DateKey): string {
  return MONTHS[parseDateKey(key).month - 1]!;
}

export function formatDayMonth(key: DateKey): string {
  return `${parseDateKey(key).day} ${monthLong(key).slice(0, 3)}`;
}

export function formatShortDate(key: DateKey): string {
  return `${weekdayShort(key)} ${formatDayMonth(key)}`;
}

export function formatFullDate(key: DateKey): string {
  return `${formatDayMonth(key)} ${parseDateKey(key).year}`;
}

export function formatWeekdayLong(key: DateKey): string {
  return `${WEEKDAYS[weekdayIndex(key)]} ${parseDateKey(key).day} ${monthLong(key)}`;
}

export function formatMonthYear(key: DateKey): string {
  return `${monthLong(key)} ${parseDateKey(key).year}`;
}

export function formatMonthShort(key: DateKey): string {
  return monthLong(key).slice(0, 3);
}

export function formatWeekRange(weekStart: DateKey): string {
  return `${formatDayMonth(weekStart)} – ${formatDayMonth(addDays(weekStart, 6))}`;
}

export function formatRelativeDay(key: DateKey, today: DateKey): string {
  const diff = daysBetween(today, key);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff >= 2 && diff <= 6) return `In ${diff} days`;
  return formatShortDate(key);
}

export function formatSinceLabel(from: DateKey, today: DateKey): string {
  const f = parseDateKey(from);
  const t = parseDateKey(today);
  if (f.year === t.year && f.month === t.month) return `since ${formatDayMonth(from)}`;
  if (f.year === t.year) return `since ${monthLong(from)}`;
  return `since ${formatMonthYear(from)}`;
}

/** `iso` is our own normalised UTC string, never a raw Lyfta string. */
export function formatRelativeTime(iso: string, now: Date): string {
  const then = new Date(iso);
  const elapsedSeconds = (now.getTime() - then.getTime()) / 1000;
  if (elapsedSeconds < 60) return 'just now';
  if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)} min ago`;
  const thenKey = localDateKey(then);
  const nowKey = localDateKey(now);
  if (thenKey === nowKey) return `${Math.floor(elapsedSeconds / 3600)} h ago`;
  if (daysBetween(thenKey, nowKey) === 1) return 'yesterday';
  return parseDateKey(thenKey).year === parseDateKey(nowKey).year
    ? formatDayMonth(thenKey)
    : formatFullDate(thenKey);
}
