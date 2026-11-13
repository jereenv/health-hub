import { Platform } from 'react-native';
import {
  SdkAvailabilityStatus,
  aggregateGroupByPeriod,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
} from 'react-native-health-connect';

import { addDays, localDateKey, parseDateKey } from '@/domain/time/localDate';
import type { DateKey } from '@/domain/time/localDate';

import { READ_RECORD_TYPES, SAMSUNG_HEALTH_ORIGIN } from './constants';
import type { ReadRecordType } from './constants';
import type {
  DailyKind,
  DateRange,
  HealthConnectAccess,
  HealthConnectAvailability,
  HealthConnectGateway,
} from './HealthConnectGateway';
import {
  parseBodyRecords,
  parseDailyHeartRate,
  parseDailyValues,
  parseFirstStartTime,
  parseSleepRecords,
} from './parseHealthConnect';
import { pageThrough } from './pageThrough';

const INTERVAL_TYPES = [
  'Steps',
  'Distance',
  'ActiveCaloriesBurned',
  'TotalCaloriesBurned',
  'HeartRate',
  'SleepSession',
] as const;
const SINCE = '2000-01-01T00:00:00Z';
const PAGE_SIZE = 1000;
/** Android 14 (API 34) ships Health Connect in the system; older versions need the app. */
const ANDROID_WITH_BUILT_IN_HEALTH_CONNECT = 34;
/** History counts as granted when records older than this many days are readable (see getAccess). */
const HISTORY_PROBE_DAYS = 29;

const AGGREGATE_TYPE = {
  steps: 'Steps',
  distanceM: 'Distance',
  activeKcal: 'ActiveCaloriesBurned',
  totalKcal: 'TotalCaloriesBurned',
} as const satisfies Record<DailyKind, string>;

/** The UTC instant of local midnight on a calendar day. */
function localMidnightIso(key: DateKey): string {
  const { year, month, day } = parseDateKey(key);
  return new Date(year, month - 1, day).toISOString();
}

function samsungDays(range: DateRange) {
  return {
    timeRangeFilter: {
      operator: 'between' as const,
      startTime: localMidnightIso(range.from),
      endTime: localMidnightIso(range.toExclusive),
    },
    timeRangeSlicer: { period: 'DAYS' as const, length: 1 },
    dataOriginFilter: [SAMSUNG_HEALTH_ORIGIN],
  };
}

export function createExpoHealthConnectGateway(
  now: () => Date = () => new Date(),
): HealthConnectGateway {
  let initialised: Promise<boolean> | null = null;
  function ensureInitialised(): Promise<boolean> {
    initialised ??= initialize().catch(() => false);
    return initialised;
  }

  async function earliestDate(): Promise<DateKey | null> {
    await ensureInitialised();
    let earliest: DateKey | null = null;
    for (const type of INTERVAL_TYPES) {
      const { records } = await readRecords(type, {
        timeRangeFilter: { operator: 'after', startTime: SINCE },
        dataOriginFilter: [SAMSUNG_HEALTH_ORIGIN],
        ascendingOrder: true,
        pageSize: 1,
      });
      const start = parseFirstStartTime(records);
      if (start === null) continue;
      const day = localDateKey(start);
      if (earliest === null || day < earliest) earliest = day;
    }
    return earliest;
  }

  async function getAccess(): Promise<HealthConnectAccess> {
    await ensureInitialised();
    const granted = await getGrantedPermissions();
    // Extra names (e.g. StepsCadence, unlocked by READ_STEPS) are ignored: compare only ours.
    const grantedTypes = new Set(
      granted.filter((p) => p.accessType === 'read').map((p) => p.recordType as string),
    );
    const missing: ReadRecordType[] = READ_RECORD_TYPES.filter((type) => !grantedTypes.has(type));
    const readAll = missing.length === 0;
    if (!readAll) return { readAll, history: false, missing };
    // The library never lists ReadHealthDataHistory in getGrantedPermissions(): its permission
    // mapping only maps exercise-route and background access back. So history is inferred from
    // data: records older than 29 days are only readable when the history permission is granted.
    const earliest = await earliestDate();
    const history =
      earliest !== null && earliest < addDays(localDateKey(now()), -HISTORY_PROBE_DAYS);
    return { readAll, history, missing };
  }

  return {
    async availability(): Promise<HealthConnectAvailability> {
      try {
        const status = await getSdkStatus();
        if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
          return 'update_required';
        }
        if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
          return typeof Platform.Version === 'number' &&
            Platform.Version < ANDROID_WITH_BUILT_IN_HEALTH_CONNECT
            ? 'not_installed'
            : 'unavailable';
        }
        if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return 'unavailable';
        return (await ensureInitialised()) ? 'available' : 'unavailable';
      } catch {
        return 'unavailable';
      }
    },

    getAccess,

    async requestAccess() {
      await ensureInitialised();
      await requestPermission([
        ...READ_RECORD_TYPES.map((recordType) => ({ accessType: 'read' as const, recordType })),
        { accessType: 'read' as const, recordType: 'ReadHealthDataHistory' as const },
      ]);
      return getAccess();
    },

    earliestDate,

    async dailyValues(kind, range) {
      await ensureInitialised();
      const groups = await aggregateGroupByPeriod({
        recordType: AGGREGATE_TYPE[kind],
        ...samsungDays(range),
      });
      return parseDailyValues(kind, groups).items;
    },

    async dailyHeartRate(range) {
      await ensureInitialised();
      const groups = await aggregateGroupByPeriod({
        recordType: 'HeartRate',
        ...samsungDays(range),
      });
      return parseDailyHeartRate(groups).items;
    },

    async sleepRecords(range) {
      await ensureInitialised();
      // Padded a day each side so sessions that end in the range but start before it are found.
      const records = await pageThrough((pageToken) =>
        readRecords('SleepSession', {
          timeRangeFilter: {
            operator: 'between',
            startTime: localMidnightIso(addDays(range.from, -1)),
            endTime: localMidnightIso(addDays(range.toExclusive, 1)),
          },
          dataOriginFilter: [SAMSUNG_HEALTH_ORIGIN],
          pageSize: PAGE_SIZE,
          pageToken,
        }),
      );
      return parseSleepRecords(records).items.filter((session) => {
        const wake = localDateKey(session.endAt);
        return wake >= range.from && wake < range.toExclusive;
      });
    },

    async bodyRecords(kind) {
      await ensureInitialised();
      const records = await pageThrough((pageToken) =>
        readRecords(kind === 'weight' ? 'Weight' : 'BodyFat', {
          timeRangeFilter: { operator: 'after', startTime: SINCE },
          pageSize: PAGE_SIZE,
          pageToken,
        }),
      );
      return parseBodyRecords(kind, records).items;
    },

    openSettings() {
      openHealthConnectSettings();
    },
  };
}
