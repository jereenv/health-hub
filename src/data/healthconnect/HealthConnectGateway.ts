import type { DateKey } from '@/domain/time/localDate';

import type { ReadRecordType } from './constants';

export type HealthConnectAvailability =
  'available' | 'not_installed' | 'update_required' | 'unavailable';

export interface HealthConnectAccess {
  /** All eight read permissions are granted. */
  readAll: boolean;
  /** The app may read data older than 30 days before the first permission grant. */
  history: boolean;
  missing: ReadRecordType[];
}

/** Local days from `from` up to but not including `toExclusive`. */
export interface DateRange {
  from: DateKey;
  toExclusive: DateKey;
}

export type DailyKind = 'steps' | 'distanceM' | 'activeKcal' | 'totalKcal';
export interface DailyValue {
  date: DateKey;
  value: number;
}
export interface DailyHeartRate {
  date: DateKey;
  minBpm: number;
  avgBpm: number;
  maxBpm: number;
}

export type SleepStageName =
  'awake' | 'out_of_bed' | 'asleep' | 'light' | 'deep' | 'rem' | 'unknown';
export interface SleepRecord {
  hcId: string;
  startAt: string;
  endAt: string;
  stages: { stage: SleepStageName; startAt: string; endAt: string }[];
}

/** A weight (kg) or body fat (percent) record. */
export interface BodyRecord {
  hcId: string;
  time: string;
  origin: string;
  value: number;
}

/** The only door to Health Connect. Everything else in the app talks to this interface. */
export interface HealthConnectGateway {
  availability(): Promise<HealthConnectAvailability>;
  getAccess(): Promise<HealthConnectAccess>;
  requestAccess(): Promise<HealthConnectAccess>;
  /** Earliest Samsung record over the six interval types. */
  earliestDate(): Promise<DateKey | null>;
  dailyValues(kind: DailyKind, range: DateRange): Promise<DailyValue[]>;
  dailyHeartRate(range: DateRange): Promise<DailyHeartRate[]>;
  /** Sessions whose END falls in the range. */
  sleepRecords(range: DateRange): Promise<SleepRecord[]>;
  /** All history, all origins. */
  bodyRecords(kind: 'weight' | 'bodyFat'): Promise<BodyRecord[]>;
  openSettings(): void;
}
