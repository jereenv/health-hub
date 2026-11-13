import {
  formatDayMonth,
  formatFullDate,
  formatMonthShort,
  formatMonthYear,
  formatRelativeDay,
  formatRelativeTime,
  formatShortDate,
  formatSinceLabel,
  formatWeekdayLong,
  formatWeekRange,
} from './dates';

test('date labels', () => {
  expect(formatShortDate('2026-11-11')).toBe('Wed 11 Nov');
  expect(formatDayMonth('2026-11-11')).toBe('11 Nov');
  expect(formatFullDate('2026-11-11')).toBe('11 Nov 2026');
  expect(formatWeekdayLong('2026-11-12')).toBe('Thursday 12 November');
  expect(formatWeekRange('2026-10-26')).toBe('26 Oct – 1 Nov');
  expect(formatMonthYear('2026-11-03')).toBe('November 2026');
  expect(formatMonthShort('2026-11-03')).toBe('Nov');
});

test.each([
  ['2026-11-12', 'Today'],
  ['2026-11-13', 'Tomorrow'],
  ['2026-11-15', 'In 3 days'],
  ['2026-11-21', 'Sat 21 Nov'],
  ['2026-11-11', 'Yesterday'],
  ['2026-11-10', 'Tue 10 Nov'],
])('formatRelativeDay(%p) from 2026-11-12 = %p', (k, t) =>
  expect(formatRelativeDay(k, '2026-11-12')).toBe(t),
);

test('formatSinceLabel names the month, or the day within the same month', () => {
  expect(formatSinceLabel('2026-09-14', '2026-11-12')).toBe('since September');
  expect(formatSinceLabel('2026-11-03', '2026-11-12')).toBe('since 3 Nov');
  expect(formatSinceLabel('2025-12-01', '2026-11-12')).toBe('since December 2025');
});

test.each([
  ['2026-11-12T14:59:30.000Z', 'just now'],
  ['2026-11-12T14:55:00.000Z', '5 min ago'],
  ['2026-11-12T12:00:00.000Z', '3 h ago'],
  ['2026-11-11T20:00:00.000Z', 'yesterday'],
  ['2026-11-01T12:00:00.000Z', '1 Nov'],
  ['2025-11-01T12:00:00.000Z', '1 Nov 2025'],
])('formatRelativeTime(%p) at 10:00 local = %p', (iso, t) =>
  expect(formatRelativeTime(iso, new Date('2026-11-12T15:00:00.000Z'))).toBe(t),
);
