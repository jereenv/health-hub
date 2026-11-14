import { isSameTime, isSameWeighIn } from './weighInMatch';

const BASE = '2026-11-13T12:00:00.000Z';
const at = (offsetSeconds: number) =>
  new Date(Date.parse(BASE) + offsetSeconds * 1000).toISOString();

describe('time_window', () => {
  test.each([
    ['119 s and 0.1 kg apart', 119, 80.1, true],
    ['121 s apart', 121, 80, false],
    ['0.11 kg apart', 0, 80.11, false],
  ])('%s', (_name, seconds, weightKg, expected) => {
    expect(
      isSameWeighIn({ time: BASE, weightKg: 80 }, { time: at(seconds), weightKg }, 'time_window'),
    ).toBe(expected);
  });

  test('is the default rule', () => {
    expect(isSameWeighIn({ time: BASE, weightKg: 80 }, { time: at(60), weightKg: 80 })).toBe(true);
  });
});

describe('same_day', () => {
  // TZ is America/New_York in the test run.
  test('23:00 and 08:00 local the same day, same weight, are the same', () => {
    expect(
      isSameWeighIn(
        { time: '2026-11-14T04:00:00.000Z', weightKg: 80 },
        { time: '2026-11-13T13:00:00.000Z', weightKg: 80 },
        'same_day',
      ),
    ).toBe(true);
  });

  test('across local midnight they differ', () => {
    expect(isSameTime('2026-11-14T04:30:00.000Z', '2026-11-14T05:30:00.000Z', 'same_day')).toBe(
      false,
    );
  });
});
