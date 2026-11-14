import type { BodyReading } from '@/data/body/BodyRepository';
import type {
  ActivityDay,
  HeartRateDay,
  SleepSessionRow,
  WatchBodyFat,
} from '@/data/healthconnect/HealthConnectRepository';
import type { Profile } from '@/domain/profile/profile';
import type { DateKey } from '@/domain/time/localDate';
import type { ScheduledWorkout } from '@/domain/workouts/schedule';
import type { Workout, WeightUnit } from '@/domain/workouts/types';

export type PresetId = 'week' | 'month' | 'journey' | 'workout' | 'custom';
export type SectionId = 'body' | 'workouts' | 'activity' | 'sleep' | 'heartRate';

/** In briefing order. */
export const SECTION_IDS: readonly SectionId[] = [
  'body',
  'workouts',
  'activity',
  'sleep',
  'heartRate',
];

export const SECTION_LABEL: Readonly<Record<SectionId, string>> = {
  body: 'Body',
  workouts: 'Workouts',
  activity: 'Activity',
  sleep: 'Sleep',
  heartRate: 'Heart rate',
};

/** Inclusive on both ends. */
export interface DateWindow {
  from: DateKey;
  to: DateKey;
}

/** Everything the briefing reads, as the repositories return it (readings ascending). */
export interface ExportData {
  workouts: Workout[];
  schedule: ScheduledWorkout[];
  readings: BodyReading[];
  versions: Profile[];
  watch: WatchBodyFat[];
  activity: ActivityDay[];
  sleep: SleepSessionRow[];
  heartRate: HeartRateDay[];
}

export interface ExportRequest {
  preset: PresetId;
  sections: Readonly<Record<SectionId, boolean>>;
  starter: string;
  workoutId: number | null;
  custom: DateWindow | null;
  includeCsv: boolean;
}

export type DetailLevel = 'full' | 'medium' | 'long';

export interface PeriodView {
  window: DateWindow;
  previous: DateWindow | null;
  days: number;
  level: DetailLevel;
  today: DateKey;
  unit: WeightUnit;
  preset: PresetId;
  includesToday: boolean;
  /** Journey only: the first 7 days stand in for "previous". */
  comparisonLabel: 'previous period' | 'journey start';
}

/** Markdown lines, no trailing newline. */
export interface SectionText {
  context: string[];
  summary: string[];
  detail: string[];
}
