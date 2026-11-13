import {
  addDays,
  ageOn,
  daysBetween,
  isDateKey,
  localDateKey,
  monthStartKey,
  weekdayIndex,
  weekStartKey,
} from './localDate';

test('the test runner uses the New York time zone', () => {
  expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(300);
});

test.each([
  ['2026-11-13T03:30:00.000Z', '2026-11-12'], // 22:30 local, previous UTC day is the local day
  ['2026-11-01T04:30:00.000Z', '2026-11-01'], // 00:30 EDT
  ['2026-11-02T04:30:00.000Z', '2026-11-01'], // 23:30 EST, after DST ends
  ['2026-03-08T04:59:00.000Z', '2026-03-07'], // 23:59 EST, just before spring-forward day
  ['2026-03-09T03:59:00.000Z', '2026-03-08'], // 23:59 EDT, last minute of the short day
])('localDateKey(%p) = %p', (iso, key) => expect(localDateKey(iso)).toBe(key));

test('localDateKey accepts a Date and rejects invalid input', () => {
  expect(localDateKey(new Date('2026-11-13T03:30:00.000Z'))).toBe('2026-11-12');
  expect(() => localDateKey('not a date')).toThrow(RangeError);
  expect(() => localDateKey('2026-08-20 13:05:00')).toThrow(RangeError);
  expect(() => localDateKey('2026-08-20T13:05:00')).toThrow(RangeError);
  expect(localDateKey('2026-08-20T13:05:00-04:00')).toBe('2026-08-20');
});

test('calendar arithmetic ignores DST', () => {
  expect(addDays('2026-10-31', 2)).toBe('2026-11-02');
  expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
  expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
  expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  expect(daysBetween('2026-11-01', '2026-11-15')).toBe(14);
  expect(daysBetween('2026-03-01', '2026-03-15')).toBe(14);
  expect(daysBetween('2026-11-15', '2026-11-01')).toBe(-14);
});

test('weeks start on Monday', () => {
  expect(weekStartKey('2026-11-15')).toBe('2026-11-09');
  expect(weekStartKey('2026-11-09')).toBe('2026-11-09');
  expect(weekStartKey('2026-11-01')).toBe('2026-10-26');
  expect(monthStartKey('2026-11-15')).toBe('2026-11-01');
  expect(weekdayIndex('2026-11-15')).toBe(6);
  expect(weekdayIndex('2026-11-09')).toBe(0);
});

test('ageOn counts whole years', () => {
  expect(ageOn('1996-11-13', '2026-11-12')).toBe(29);
  expect(ageOn('1996-11-12', '2026-11-12')).toBe(30);
});

test('isDateKey accepts real dates and rejects everything else', () => {
  expect(isDateKey('2026-02-28')).toBe(true);
  expect(isDateKey('2028-02-29')).toBe(true);
  expect(isDateKey('2026-02-30')).toBe(false);
  expect(isDateKey('2026-2-3')).toBe(false);
  expect(isDateKey('2026-11-12T00:00:00Z')).toBe(false);
});
