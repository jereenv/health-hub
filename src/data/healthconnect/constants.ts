/** Health Connect package name of the app that writes the scale readings (MovingLife). */
export const MOVINGLIFE_ORIGIN = 'com.moving.movinglife';
/** Health Connect package name of Samsung Health, the source of daily activity and sleep. */
export const SAMSUNG_HEALTH_ORIGIN = 'com.sec.android.app.shealth';

export const READ_RECORD_TYPES = [
  'Steps',
  'Distance',
  'ActiveCaloriesBurned',
  'TotalCaloriesBurned',
  'HeartRate',
  'SleepSession',
  'Weight',
  'BodyFat',
] as const;
export type ReadRecordType = (typeof READ_RECORD_TYPES)[number];

/** Manifest permissions, one per read record type, then the history permission last. */
export const MANIFEST_PERMISSIONS: readonly string[] = [
  'android.permission.health.READ_STEPS',
  'android.permission.health.READ_DISTANCE',
  'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
  'android.permission.health.READ_TOTAL_CALORIES_BURNED',
  'android.permission.health.READ_HEART_RATE',
  'android.permission.health.READ_SLEEP',
  'android.permission.health.READ_WEIGHT',
  'android.permission.health.READ_BODY_FAT',
  'android.permission.health.READ_HEALTH_DATA_HISTORY',
];

/**
 * How two weigh-ins count as the same one. `time_window`: within WEIGH_IN_WINDOW_MS and
 * WEIGH_IN_WEIGHT_TOLERANCE_KG. `same_day`: same local day and within the weight tolerance.
 */
export const WEIGH_IN_MATCH: 'time_window' | 'same_day' = 'time_window';
export const WEIGH_IN_WINDOW_MS = 120_000;
export const WEIGH_IN_WEIGHT_TOLERANCE_KG = 0.1;

/** Days of daily data each sync re-reads and replaces. */
export const WINDOW_DAYS_BACK = 14;
/** Days per read when a full import is split into chunks. */
export const CHUNK_DAYS = 92;
/** Hard ceiling on pages fetched in one listing. */
export const MAX_PAGES = 200;
