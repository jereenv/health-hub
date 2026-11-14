import type { BodyReading } from '@/data/body/BodyRepository';
import type {
  ActivityDay,
  HeartRateDay,
  SleepSessionRow,
  WatchBodyFat,
} from '@/data/healthconnect/HealthConnectRepository';
import type { Profile } from '@/domain/profile/profile';
import type { DateKey } from '@/domain/time/localDate';
import { addDays, parseDateKey } from '@/domain/time/localDate';
import type { ScheduledWorkout } from '@/domain/workouts/schedule';
import type { Workout } from '@/domain/workouts/types';
import { makeExercise, makeSet, makeWorkout } from '@/test-support/workoutBuilders';

import type { ExportData } from '../types';

// Every number here is invented. The dates are real calendar dates: today is Thursday
// 2026-11-12, and weeks start on Monday 2026-11-09.

export const SYNTHETIC_TODAY: DateKey = '2026-11-12';

/** Local wall-clock time on a day as the ISO UTC string the app stores. */
export function localIso(date: DateKey, hour = 7, minute = 0): string {
  const { year, month, day } = parseDateKey(date);
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

export const SYNTHETIC_PROFILE: Profile = {
  heightCm: 175,
  birthDate: '1995-06-15',
  sex: 'male',
  goalWeightKg: 75,
  bmiCutoffs: 'who',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
};

/** A MovingLife-style weigh-in: no impedance, body fat given. */
export function weighIn(
  id: number,
  date: DateKey,
  weightKg: number,
  bodyFatPct: number | null,
  hour = 7,
  impedanceOhm: number | null = null,
): BodyReading {
  return {
    id,
    measuredAt: localIso(date, hour),
    weightKg,
    impedanceOhm,
    source: 'health_connect',
    legacyBodyFatPct: bodyFatPct,
  };
}

export function scheduled(date: DateKey, title: string, completed = false): ScheduledWorkout {
  return {
    lyftaId: `s-${date}`,
    date,
    title,
    templateId: null,
    source: null,
    status: null,
    completed,
  };
}

interface ExerciseSpec {
  id: number;
  name: string;
  sets: readonly (readonly [number, number])[];
}

/** A workout at 18:00 local; the owner does not tick sets, so none is completed. */
export function workoutOn(
  lyftaId: number,
  date: DateKey,
  title: string,
  exercises: readonly ExerciseSpec[],
  durationS: number | null = null,
): Workout {
  return makeWorkout({
    lyftaId,
    performedAt: localIso(date, 18),
    title,
    durationS,
    exercises: exercises.map((exercise, position) =>
      makeExercise({
        position,
        exerciseId: exercise.id,
        name: exercise.name,
        sets: exercise.sets.map(([weightKg, reps], setPosition) =>
          makeSet({ position: setPosition, weightKg, reps, completed: false }),
        ),
      }),
    ),
  });
}

const BENCH = (sets: ExerciseSpec['sets']): ExerciseSpec => ({ id: 1, name: 'Bench Press', sets });

export function sleepSession(
  wakeDate: DateKey,
  bedClock: string,
  wakeClock: string,
  asleepS: number,
  stages: { lightS: number; deepS: number; remS: number } | null = null,
): SleepSessionRow {
  const [bedHour, bedMinute] = bedClock.split(':').map(Number) as [number, number];
  const [wakeHour, wakeMinute] = wakeClock.split(':').map(Number) as [number, number];
  // A bedtime later in the day than the wake time is the evening before.
  const bedDate =
    bedHour * 60 + bedMinute > wakeHour * 60 + wakeMinute ? addDays(wakeDate, -1) : wakeDate;
  return {
    hcId: `sleep-${wakeDate}-${bedClock}`,
    startAt: localIso(bedDate, bedHour, bedMinute),
    endAt: localIso(wakeDate, wakeHour, wakeMinute),
    wakeDate,
    asleepS,
    awakeS: 0,
    lightS: stages?.lightS ?? null,
    deepS: stages?.deepS ?? null,
    remS: stages?.remS ?? null,
    hasStages: stages !== null,
  };
}

function activity(
  date: DateKey,
  steps: number | null,
  distanceM: number | null = null,
): ActivityDay {
  return { date, steps, distanceM, activeKcal: null, totalKcal: null };
}

function heartRate(date: DateKey, minBpm: number, avgBpm: number, maxBpm: number): HeartRateDay {
  return { date, minBpm, avgBpm, maxBpm };
}

function watchCheck(date: DateKey, hour: number, bodyFatPct: number): WatchBodyFat {
  return {
    hcId: `watch-${date}-${hour}`,
    measuredAt: localIso(date, hour),
    bodyFatPct,
    origin: 'health_connect',
  };
}

const HOUR = 3600;

/** The 7 days 2026-11-06..2026-11-12 plus the 7 before, as listed in Plan 6's constraints. */
export function syntheticWeek(): ExportData {
  return {
    versions: [SYNTHETIC_PROFILE],
    readings: [
      weighIn(1, '2026-10-16', 87.0, 27.0),
      weighIn(2, '2026-10-20', 86.4, 26.4),
      weighIn(3, '2026-10-25', 85.8, 25.8),
      weighIn(4, '2026-10-30', 85.0, 25.0),
      weighIn(5, '2026-11-01', 84.8, 24.8),
      weighIn(6, '2026-11-03', 84.6, 24.6),
      weighIn(7, '2026-11-04', 84.4, 24.4),
      weighIn(8, '2026-11-06', 84.0, 24.0),
      weighIn(9, '2026-11-08', 83.8, 23.8),
      weighIn(10, '2026-11-08', 84.6, 24.6, 21),
      weighIn(11, '2026-11-09', 83.6, 23.6),
      weighIn(12, '2026-11-10', 83.4, 23.4),
      weighIn(13, '2026-11-12', 83.2, 23.2),
    ],
    watch: [
      watchCheck('2026-11-08', 9, 26.1),
      watchCheck('2026-11-08', 20, 26.5),
      watchCheck('2026-11-11', 9, 26.0),
    ],
    workouts: [
      workoutOn(101, '2026-10-19', 'Upper Strength', [
        BENCH([
          [85, 5],
          [85, 5],
        ]),
      ]),
      workoutOn(102, '2026-11-02', 'Upper Strength', [
        BENCH([
          [80, 5],
          [80, 5],
          [85, 3],
        ]),
      ]),
      workoutOn(
        103,
        '2026-11-07',
        'Upper Strength',
        [
          BENCH([
            [80, 5],
            [85, 5],
            [90, 3],
          ]),
          {
            id: 2,
            name: 'Pull-up',
            sets: [
              [0, 8],
              [0, 8],
            ],
          },
        ],
        3480,
      ),
      workoutOn(104, '2026-11-09', 'Lower Strength', [
        {
          id: 3,
          name: 'Squat',
          sets: [
            [100, 5],
            [100, 5],
            [105, 3],
          ],
        },
      ]),
      workoutOn(105, '2026-11-11', 'Pull', [
        {
          id: 4,
          name: 'Barbell Row',
          sets: [
            [70, 8],
            [70, 8],
            [70, 7],
          ],
        },
      ]),
    ],
    schedule: [
      scheduled('2026-11-02', 'Upper Strength'),
      scheduled('2026-11-04', 'Lower Strength'),
      scheduled('2026-11-07', 'Upper Strength'),
      scheduled('2026-11-09', 'Lower Strength'),
      scheduled('2026-11-10', 'Cardio'),
      scheduled('2026-11-11', 'Pull'),
      scheduled('2026-11-12', 'Upper Strength'),
    ],
    activity: [
      activity('2026-10-30', 5000),
      activity('2026-10-31', 6000, 5000),
      activity('2026-11-02', 7000),
      activity('2026-11-03', 8000),
      activity('2026-11-04', 9000, 6000),
      activity('2026-11-05', 6000),
      activity('2026-11-06', 8000, 6000),
      activity('2026-11-07', 6000),
      activity('2026-11-09', 10000, 8000),
      activity('2026-11-10', 7000),
      activity('2026-11-11', 9000, 7000),
      activity('2026-11-12', 2500),
    ],
    sleep: [
      sleepSession('2026-11-01', '23:00', '06:00', 7 * HOUR),
      sleepSession('2026-11-03', '23:00', '06:00', 7 * HOUR),
      sleepSession('2026-11-04', '23:00', '06:00', 7 * HOUR),
      sleepSession('2026-11-07', '23:30', '06:00', 6.5 * HOUR),
      sleepSession('2026-11-08', '23:00', '06:30', 7 * HOUR, {
        lightS: 14400,
        deepS: 5400,
        remS: 5400,
      }),
      sleepSession('2026-11-10', '22:45', '06:30', 7.5 * HOUR),
      sleepSession('2026-11-10', '13:00', '13:30', 0.5 * HOUR),
      sleepSession('2026-11-11', '00:15', '06:15', 6 * HOUR, {
        lightS: 12000,
        deepS: 4800,
        remS: 4800,
      }),
      sleepSession('2026-11-12', '23:15', '06:30', 7.25 * HOUR),
    ],
    heartRate: [
      heartRate('2026-10-31', 53, 69, 135),
      heartRate('2026-11-03', 52, 68, 138),
      heartRate('2026-11-06', 52, 68, 140),
      heartRate('2026-11-08', 50, 66, 120),
      heartRate('2026-11-10', 54, 70, 150),
      heartRate('2026-11-11', 51, 67, 130),
      heartRate('2026-11-12', 55, 72, 160),
    ],
  };
}

const JOURNEY_DAYS = 120;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 120 consecutive days ending 2026-11-12, generated from a fixed formula. */
export function syntheticJourney(): ExportData {
  const start = addDays(SYNTHETIC_TODAY, -(JOURNEY_DAYS - 1));
  const data: ExportData = {
    versions: [SYNTHETIC_PROFILE],
    readings: [],
    watch: [],
    workouts: [],
    schedule: [],
    activity: [],
    sleep: [],
    heartRate: [],
  };
  for (let i = 0; i < JOURNEY_DAYS; i++) {
    const date = addDays(start, i);
    if (i % 5 !== 4) {
      data.readings.push(weighIn(i + 1, date, round2(90 - 0.05 * i), round2(28 - 0.02 * i)));
    }
    const steps = i % 9 === 8 ? null : 5000 + (i % 7) * 700;
    data.activity.push(activity(date, steps, steps === null ? null : steps * 0.75));
    if (i % 2 === 0) {
      data.workouts.push(
        workoutOn(1000 + i, date, 'Upper Strength', [
          BENCH([
            [60 + (i % 10), 5],
            [60 + (i % 10), 5],
            [65 + (i % 10), 3],
          ]),
        ]),
      );
    }
    if (i % 11 !== 10) {
      data.sleep.push(sleepSession(date, '23:00', '06:30', 7 * HOUR + (i % 4) * 600));
    }
    if (i % 13 !== 12) {
      data.heartRate.push(heartRate(date, 50 + (i % 5), 65 + (i % 7), 120 + (i % 11)));
    }
  }
  return data;
}
