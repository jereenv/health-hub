import type { HealthConnectRepository } from '@/data/healthconnect/HealthConnectRepository';
import type { SyncState } from '@/data/sync/SyncStateRepository';
import { formatRelativeTime } from '@/domain/format/dates';
import { formatCount } from '@/domain/format/numbers';
import type { HealthConnectConnection } from '@/ui/data/useAppData';

export interface HealthConnectStatusInput {
  connection: HealthConnectConnection;
  state: SyncState;
  running: boolean;
  now: Date;
}

export interface HealthConnectLine {
  text: string;
  tone: 'muted' | 'warning';
}

export type HealthConnectCounts = Awaited<ReturnType<HealthConnectRepository['counts']>>;

const HISTORY_HINT = "Allow 'Access past data' to import everything.";

function errorAge(state: SyncState, now: Date): string {
  return state.lastErrorAt === null ? '' : ` ${formatRelativeTime(state.lastErrorAt, now)}`;
}

/** One line for headers and rows. The first matching condition wins. */
export function describeHealthConnectStatus(input: HealthConnectStatusInput): HealthConnectLine {
  const { connection, state, running, now } = input;
  const { availability, access } = connection;
  if (availability === 'not_installed') {
    return { text: 'Install Health Connect', tone: 'warning' };
  }
  if (availability === 'update_required') {
    return { text: 'Update Health Connect', tone: 'warning' };
  }
  if (availability === 'unavailable') {
    return { text: "Health Connect isn't available", tone: 'warning' };
  }
  if (access === null || !access.readAll) return { text: 'Not connected', tone: 'warning' };
  if (running) return { text: 'Syncing…', tone: 'muted' };
  if (state.lastError !== null) {
    return { text: `Sync failed${errorAge(state, now)}`, tone: 'warning' };
  }
  if (!access.history) return { text: 'Connected · last 30 days only', tone: 'warning' };
  if (state.lastSuccessAt !== null) {
    return { text: `Synced ${formatRelativeTime(state.lastSuccessAt, now)}`, tone: 'muted' };
  }
  return { text: 'Not synced yet', tone: 'muted' };
}

function describeCounts(counts: HealthConnectCounts): string {
  return [
    `${formatCount(counts.activityDays, 'day')} of activity`,
    `${formatCount(counts.sleepSessions, 'night')} of sleep`,
    `${formatCount(counts.weighIns, 'weigh-in')} from MovingLife`,
    formatCount(counts.watchBodyFat, 'watch body-fat check'),
  ].join(' · ');
}

/** Every line that applies, for the expanded rows in Settings. */
export function describeHealthConnectDetails(
  input: HealthConnectStatusInput & { counts: HealthConnectCounts },
): HealthConnectLine[] {
  const { connection, state, now, counts } = input;
  const lines: HealthConnectLine[] = [];
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
  lines.push({ text: describeCounts(counts), tone: 'muted' });
  if (connection.access !== null && connection.access.readAll && !connection.access.history) {
    lines.push({ text: HISTORY_HINT, tone: 'warning' });
  }
  return lines;
}
