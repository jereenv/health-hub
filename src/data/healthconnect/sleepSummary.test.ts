import type { SleepRecord } from './HealthConnectGateway';
import { parseSleepRecords } from './parseHealthConnect';
import { summariseSleep } from './sleepSummary';

const sleep = require('./__fixtures__/sleep-records.json');

function stage(name: SleepRecord['stages'][number]['stage'], from: string, to: string) {
  return { stage: name, startAt: from, endAt: to };
}

test('stage totals: asleep is sleeping+light+deep+rem, awake is awake+out_of_bed, unknown ignored', () => {
  const row = summariseSleep({
    hcId: 's',
    startAt: '2026-11-12T00:00:00.000Z',
    endAt: '2026-11-12T08:00:00.000Z',
    stages: [
      stage('awake', '2026-11-12T00:00:00.000Z', '2026-11-12T00:10:00.000Z'),
      stage('out_of_bed', '2026-11-12T00:10:00.000Z', '2026-11-12T00:20:00.000Z'),
      stage('asleep', '2026-11-12T00:20:00.000Z', '2026-11-12T01:20:00.000Z'),
      stage('light', '2026-11-12T01:20:00.000Z', '2026-11-12T03:20:00.000Z'),
      stage('deep', '2026-11-12T03:20:00.000Z', '2026-11-12T04:20:00.000Z'),
      stage('rem', '2026-11-12T04:20:00.000Z', '2026-11-12T05:20:00.000Z'),
      stage('unknown', '2026-11-12T05:20:00.000Z', '2026-11-12T08:00:00.000Z'),
    ],
  });
  expect(row).toMatchObject({
    asleepS: (60 + 120 + 60 + 60) * 60,
    awakeS: 20 * 60,
    lightS: 120 * 60,
    deepS: 60 * 60,
    remS: 60 * 60,
    hasStages: true,
  });
});

test('a session without stages counts its whole length as asleep and has null stage columns', () => {
  const row = summariseSleep({
    hcId: 's',
    startAt: '2026-11-12T00:00:00.000Z',
    endAt: '2026-11-12T01:00:00.000Z',
    stages: [stage('unknown', '2026-11-12T00:00:00.000Z', '2026-11-12T01:00:00.000Z')],
  });
  expect(row).toMatchObject({
    asleepS: 3600,
    awakeS: 0,
    lightS: null,
    deepS: null,
    remS: null,
    hasStages: false,
  });
});

test('a session ending after local midnight belongs to the day it ends', () => {
  // 03:30Z is 23:30 on the 11th in New York; 11:30Z is 06:30 on the 12th.
  const record = parseSleepRecords(sleep).items[0]!;
  expect(summariseSleep(record)!.wakeDate).toBe('2026-11-12');
  const late = summariseSleep({
    hcId: 's',
    startAt: '2026-11-12T02:00:00.000Z',
    endAt: '2026-11-12T03:30:00.000Z',
    stages: [],
  });
  expect(late!.wakeDate).toBe('2026-11-11');
});

test('the night ending on the DST change (2026-11-01) keeps wake date 2026-11-01', () => {
  // 04:00Z is 00:00 EDT; 11:00Z is 06:00 EST, after the clocks went back at 06:00Z.
  const row = summariseSleep({
    hcId: 's',
    startAt: '2026-11-01T04:00:00.000Z',
    endAt: '2026-11-01T11:00:00.000Z',
    stages: [],
  });
  expect(row!.wakeDate).toBe('2026-11-01');
  expect(row!.asleepS).toBe(7 * 3600);
});

test('end before start gives null', () => {
  const at = '2026-11-12T00:00:00.000Z';
  expect(summariseSleep({ hcId: 's', startAt: at, endAt: at, stages: [] })).toBeNull();
  expect(
    summariseSleep({ hcId: 's', startAt: '2026-11-12T01:00:00.000Z', endAt: at, stages: [] }),
  ).toBeNull();
});
