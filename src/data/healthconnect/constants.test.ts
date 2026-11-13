import fs from 'fs';
import path from 'path';

import {
  MANIFEST_PERMISSIONS,
  READ_RECORD_TYPES,
  WEIGH_IN_MATCH,
  WEIGH_IN_WEIGHT_TOLERANCE_KG,
  WEIGH_IN_WINDOW_MS,
  WINDOW_DAYS_BACK,
} from './constants';
import type { ReadRecordType } from './constants';

interface AppJson {
  expo: { android: { permissions: string[] }; plugins: (string | [string, unknown])[] };
}

const appJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', '..', 'app.json'), 'utf8'),
) as AppJson;

const PERMISSION_FOR_TYPE: Record<ReadRecordType, string> = {
  Steps: 'android.permission.health.READ_STEPS',
  Distance: 'android.permission.health.READ_DISTANCE',
  ActiveCaloriesBurned: 'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
  TotalCaloriesBurned: 'android.permission.health.READ_TOTAL_CALORIES_BURNED',
  HeartRate: 'android.permission.health.READ_HEART_RATE',
  SleepSession: 'android.permission.health.READ_SLEEP',
  Weight: 'android.permission.health.READ_WEIGHT',
  BodyFat: 'android.permission.health.READ_BODY_FAT',
};

test('app.json declares exactly the manifest permissions', () => {
  expect([...appJson.expo.android.permissions].sort()).toEqual([...MANIFEST_PERMISSIONS].sort());
});

test('every read record type has a permission and the history permission is last', () => {
  for (const type of READ_RECORD_TYPES) {
    expect(MANIFEST_PERMISSIONS).toContain(PERMISSION_FOR_TYPE[type]);
  }
  expect(MANIFEST_PERMISSIONS).toHaveLength(READ_RECORD_TYPES.length + 1);
  expect(MANIFEST_PERMISSIONS[MANIFEST_PERMISSIONS.length - 1]).toBe(
    'android.permission.health.READ_HEALTH_DATA_HISTORY',
  );
});

test('the plugins include react-native-health-connect and no expo-health-connect', () => {
  const names = appJson.expo.plugins.map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin));
  expect(names).toContain('react-native-health-connect');
  expect(names).not.toContain('expo-health-connect');
});

test('the dedupe constants are the spec values', () => {
  expect(WEIGH_IN_WINDOW_MS).toBe(120_000);
  expect(WEIGH_IN_WEIGHT_TOLERANCE_KG).toBe(0.1);
  expect(WINDOW_DAYS_BACK).toBe(14);
  expect(WEIGH_IN_MATCH).toBe('time_window');
});
