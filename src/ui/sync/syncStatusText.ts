import type { SyncState } from '@/data/sync/SyncStateRepository';
import { formatRelativeTime } from '@/domain/format/dates';
import { formatCount } from '@/domain/format/numbers';

export interface SyncStatusInput {
  state: SyncState;
  running: boolean;
  hasKey: boolean;
  now: Date;
  noun: 'workout' | 'scheduled workout';
}

export interface SyncStatusLine {
  text: string;
  tone: 'muted' | 'warning';
}

const INVALID_KEY = 'invalid_key';

function errorAge(state: SyncState, now: Date): string {
  return state.lastErrorAt === null ? '' : ` ${formatRelativeTime(state.lastErrorAt, now)}`;
}

/** One line for headers and rows. The first matching condition wins. */
export function describeSyncStatus(input: SyncStatusInput): SyncStatusLine {
  const { state, running, hasKey, now, noun } = input;
  if (!hasKey) return { text: 'Lyfta not connected', tone: 'warning' };
  if (running) return { text: 'Syncing…', tone: 'muted' };
  if (state.lastError === INVALID_KEY) return { text: 'Lyfta rejected the key', tone: 'warning' };
  if (state.lastError !== null) {
    return { text: `Sync failed${errorAge(state, now)}`, tone: 'warning' };
  }
  if (state.deletionPause?.reason === 'unreadable') {
    const count = formatCount(state.deletionPause.skipped, noun);
    return { text: `${count} couldn't be read · deletions paused`, tone: 'warning' };
  }
  if (state.deletionPause?.reason === 'error') {
    return { text: 'Deletion check failed · retrying next sync', tone: 'warning' };
  }
  if (state.lastSkipped > 0) {
    return { text: `${formatCount(state.lastSkipped, noun)} couldn't be read`, tone: 'warning' };
  }
  if (state.lastSuccessAt !== null) {
    return { text: `Synced ${formatRelativeTime(state.lastSuccessAt, now)}`, tone: 'muted' };
  }
  return { text: 'Not synced yet', tone: 'muted' };
}

/** Every line that applies, for the expanded rows in Settings. */
export function describeSyncDetails(input: SyncStatusInput): SyncStatusLine[] {
  const { state, now, noun } = input;
  const lines: SyncStatusLine[] = [];
  if (state.lastSuccessAt !== null) {
    lines.push({
      text: `Last synced ${formatRelativeTime(state.lastSuccessAt, now)}`,
      tone: 'muted',
    });
  }
  if (state.lastError !== null) {
    lines.push({
      text: `Last error${errorAge(state, now)}: ${state.lastError}`,
      tone: 'warning',
    });
  }
  if (state.deletionPause?.reason === 'unreadable') {
    const count = formatCount(state.deletionPause.skipped, noun);
    lines.push({
      text: `Deletions from Lyfta are paused: ${count} there can't be read. Re-sync downloads your workouts again and tries to read these.`,
      tone: 'warning',
    });
  } else if (state.deletionPause?.reason === 'error') {
    lines.push({
      text: 'Deletions from Lyfta are paused: the last check failed. It retries on the next sync.',
      tone: 'warning',
    });
  }
  if (lines.length === 0) lines.push({ text: 'Not synced yet', tone: 'muted' });
  return lines;
}
