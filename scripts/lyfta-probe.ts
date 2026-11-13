import { execFileSync } from 'node:child_process';
import os from 'node:os';

import { describeShape } from '@/data/lyfta/describeShape';
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

async function main(): Promise<void> {
  const client = createLyftaClient({ fetchFn: fetch, getApiKey });
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
