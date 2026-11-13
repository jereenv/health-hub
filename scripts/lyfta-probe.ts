import { execFileSync } from 'node:child_process';
import os from 'node:os';

import { describePattern, describeShape } from '@/data/lyfta/describeShape';
import { createLyftaClient } from '@/data/lyfta/LyftaClient';
import { LyftaError } from '@/data/lyfta/LyftaError';

/** Reads the key from the macOS Keychain. It is only ever passed to the client, never printed. */
async function getApiKey(): Promise<string | null> {
  try {
    const key = execFileSync(
      'security',
      ['find-generic-password', '-a', os.userInfo().username, '-s', 'health-hub-lyfta', '-w'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    return key === '' ? null : key;
  } catch {
    return null;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 60;
const SAFE_UNIT = /^[a-z]{1,5}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordsOf(response: unknown, key: string): Record<string, unknown>[] {
  if (!isRecord(response) || !Array.isArray(response[key])) return [];
  return response[key].filter(isRecord);
}

/** Counts how often each distinct pattern occurs. Only patterns are kept, never the values. */
function printPatterns(label: string, values: unknown[]): void {
  const counts = new Map<string, number>();
  for (const value of values) {
    const pattern = describePattern(value);
    counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
  }
  const lines = [...counts].map(([pattern, count]) => `  ${count} x ${pattern}`);
  console.log(`${label}:\n${lines.join('\n') || '  (none)'}`);
}

function isoDay(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

/** Prints value formats as patterns (and the schedule shape) so no personal value is shown. */
async function probePatterns(client: ReturnType<typeof createLyftaClient>): Promise<void> {
  const workouts = await client.listWorkouts({ page: 1, limit: 20 });
  const schedule = await client.listSchedule({
    from: isoDay(-WINDOW_DAYS),
    to: isoDay(WINDOW_DAYS),
    includeCompleted: true,
  });
  const workoutRows = recordsOf(workouts, 'workouts');
  const scheduleRows = recordsOf(schedule, 'workouts');
  printPatterns(
    'workouts.workout_perform_date',
    workoutRows.map((w) => w.workout_perform_date),
  );
  printPatterns(
    'workouts.workout_duration',
    workoutRows.map((w) => w.workout_duration),
  );
  printPatterns(
    'workouts.weight_unit',
    workoutRows.map((w) =>
      typeof w.weight_unit === 'string' && SAFE_UNIT.test(w.weight_unit)
        ? w.weight_unit
        : describePattern(w.weight_unit),
    ),
  );
  printPatterns(
    'schedule.scheduled_date',
    scheduleRows.map((w) => w.scheduled_date),
  );
  printPatterns(
    'schedule.scheduled_time',
    scheduleRows.map((w) => w.scheduled_time),
  );
  for (const [label, response] of [
    ['workouts', workouts],
    ['schedule', schedule],
  ] as const) {
    for (const field of ['total_records', 'total_pages']) {
      printPatterns(`${label}.${field}`, [isRecord(response) ? response[field] : undefined]);
    }
  }
  console.log(`schedule shape:\n${JSON.stringify(describeShape(schedule), null, 2)}`);
}

async function main(): Promise<void> {
  const client = createLyftaClient({ fetchFn: fetch, getApiKey });
  if (process.argv.includes('--patterns')) {
    try {
      await probePatterns(client);
    } catch (error) {
      console.log(error instanceof LyftaError ? `error ${error.kind}` : 'error unknown');
      process.exitCode = 1;
    }
    return;
  }
  const calls: [string, () => Promise<unknown>][] = [
    ['profile', () => client.getProfile()],
    ['schedule', () => client.listSchedule({ includeCompleted: true })],
    ['workouts', () => client.listWorkouts({ page: 1, limit: 1 })],
    ['exercises/progress', () => client.getExerciseProgress()],
  ];

  let succeeded = 0;
  for (const [label, call] of calls) {
    try {
      const shape = describeShape(await call());
      console.log(`${label}:\n${JSON.stringify(shape, null, 2)}\n`);
      succeeded += 1;
    } catch (error) {
      if (error instanceof LyftaError) {
        console.log(`${label}: error ${error.kind} ${error.status ?? ''}`.trimEnd());
      } else {
        console.log(`${label}: error unknown`);
      }
    }
  }
  if (succeeded === 0) process.exitCode = 1;
}

void main();
