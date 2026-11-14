import { formatClockTime, lastWeighInText } from './weighInText';

// Jest runs with TZ=America/New_York; 2026-11-13 is EST (UTC-5).
test('clock time uses the phone zone with am and pm', () => {
  expect(formatClockTime('2026-11-13T12:12:00.000Z')).toBe('7:12 am');
  expect(formatClockTime('2026-11-13T17:05:00.000Z')).toBe('12:05 pm');
  expect(formatClockTime('2026-11-13T05:00:00.000Z')).toBe('12:00 am');
});

test('the last weigh-in line says today, yesterday or the date', () => {
  expect(lastWeighInText('2026-11-13T12:12:00.000Z', '2026-11-13')).toBe(
    'Last weigh-in today, 7:12 am',
  );
  expect(lastWeighInText('2026-11-12T12:12:00.000Z', '2026-11-13')).toBe(
    'Last weigh-in yesterday, 7:12 am',
  );
  expect(lastWeighInText('2026-11-11T12:12:00.000Z', '2026-11-13')).toBe(
    'Last weigh-in Wed 11 Nov, 7:12 am',
  );
});
