import type { SleepSessionRow } from '@/data/healthconnect/HealthConnectRepository';

import { averageAsleepS, buildSleepNights, formatClock, sleepConsistency } from './sleepNights';
import type { SleepNight } from './sleepNights';

/** A local wall-clock time as the UTC ISO string we store. */
function local(month: number, day: number, hour: number, minute: number): string {
  return new Date(2026, month - 1, day, hour, minute).toISOString();
}

function session(
  wakeDate: string,
  startAt: string,
  endAt: string,
  rest: Partial<SleepSessionRow> = {},
): SleepSessionRow {
  return {
    hcId: `${startAt}`,
    startAt,
    endAt,
    wakeDate,
    asleepS: 25000,
    awakeS: 1200,
    lightS: 15000,
    deepS: 5000,
    remS: 5000,
    hasStages: true,
    ...rest,
  };
}

function night(bedHour: number, bedMinute: number): SleepNight {
  // Bed before midnight belongs to the previous calendar day.
  const bedDay = bedHour >= 12 ? 8 : 9;
  return {
    date: '2026-11-09',
    asleepS: 25000,
    awakeS: 0,
    lightS: null,
    deepS: null,
    remS: null,
    bedtime: local(11, bedDay, bedHour, bedMinute),
    wakeTime: local(11, 9, 7, 0),
  };
}

test('two sessions ending the same day are one night with summed stages', () => {
  const nights = buildSleepNights([
    session('2026-11-09', local(11, 8, 23, 0), local(11, 9, 3, 0), {
      asleepS: 10000,
      awakeS: 100,
      lightS: 6000,
      deepS: 2000,
      remS: 2000,
    }),
    session('2026-11-09', local(11, 9, 4, 0), local(11, 9, 7, 0), {
      asleepS: 9000,
      awakeS: 200,
      lightS: 5000,
      deepS: 1000,
      remS: 3000,
    }),
  ]);
  expect(nights).toHaveLength(1);
  expect(nights[0]).toMatchObject({
    date: '2026-11-09',
    asleepS: 19000,
    awakeS: 300,
    lightS: 11000,
    deepS: 3000,
    remS: 5000,
  });
});

test('a session without stages keeps stage columns null, and mixing sums only staged ones', () => {
  const unstaged = { hasStages: false, lightS: null, deepS: null, remS: null };
  const onlyUnstaged = buildSleepNights([
    session('2026-11-09', local(11, 8, 23, 0), local(11, 9, 7, 0), unstaged),
  ]);
  expect(onlyUnstaged[0]).toMatchObject({ lightS: null, deepS: null, remS: null, asleepS: 25000 });

  const mixed = buildSleepNights([
    session('2026-11-09', local(11, 8, 23, 0), local(11, 9, 6, 0), {
      lightS: 100,
      deepS: 200,
      remS: 300,
    }),
    session('2026-11-09', local(11, 9, 6, 30), local(11, 9, 7, 0), unstaged),
  ]);
  expect(mixed[0]).toMatchObject({ lightS: 100, deepS: 200, remS: 300, asleepS: 50000 });
});

test('nights are ascending and bedtime/wake come from the earliest start and latest end', () => {
  const early = local(11, 8, 22, 30);
  const late = local(11, 9, 7, 15);
  const nights = buildSleepNights([
    session('2026-11-10', local(11, 9, 23, 0), local(11, 10, 6, 0)),
    session('2026-11-09', local(11, 9, 4, 0), late),
    session('2026-11-09', early, local(11, 9, 3, 0)),
  ]);
  expect(nights.map((n) => n.date)).toEqual(['2026-11-09', '2026-11-10']);
  expect(nights[0]!.bedtime).toBe(early);
  expect(nights[0]!.wakeTime).toBe(late);
});

test('no sessions give no nights', () => {
  expect(buildSleepNights([])).toEqual([]);
});

test('consistency treats 23:30 and 00:30 bedtimes as one hour apart', () => {
  const result = sleepConsistency([night(23, 30), night(0, 30), night(0, 0)]);
  expect(result).toEqual({
    averageBedtimeMin: 0,
    averageWakeMin: 7 * 60,
    bedtimeSpreadMin: 24,
    nights: 3,
  });
  expect(formatClock(result!.averageBedtimeMin)).toBe('00:00');
});

test('consistency of identical nights has no spread', () => {
  const result = sleepConsistency([night(23, 40), night(23, 40), night(23, 40)]);
  expect(result).toMatchObject({ averageBedtimeMin: 23 * 60 + 40, bedtimeSpreadMin: 0 });
});

test('consistency is null under three nights', () => {
  expect(sleepConsistency([])).toBeNull();
  expect(sleepConsistency([night(23, 0), night(23, 0)])).toBeNull();
});

test('formatClock wraps past midnight and pads', () => {
  expect(formatClock(0)).toBe('00:00');
  expect(formatClock(5)).toBe('00:05');
  expect(formatClock(23 * 60 + 40)).toBe('23:40');
  expect(formatClock(1440 + 30)).toBe('00:30');
  expect(formatClock(-30)).toBe('23:30');
});

test('averageAsleepS is null with no nights', () => {
  expect(averageAsleepS([])).toBeNull();
  expect(averageAsleepS([night(23, 0), { ...night(23, 0), asleepS: 15000 }])).toBe(20000);
});
