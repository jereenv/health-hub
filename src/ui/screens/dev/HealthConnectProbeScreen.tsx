// Throwaway: Task 22 probe. Logs counts, origins and dates only; never a health value.
import { useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getGrantedPermissions,
  initialize,
  readRecords,
  requestPermission,
} from 'react-native-health-connect';
import type { RecordType } from 'react-native-health-connect';

import {
  MOVINGLIFE_ORIGIN,
  READ_RECORD_TYPES,
  SAMSUNG_HEALTH_ORIGIN,
} from '@/data/healthconnect/constants';
import { pageThrough } from '@/data/healthconnect/pageThrough';
import {
  instantTimeOf,
  summariseBodyRecords,
  summariseByOrigin,
} from '@/data/healthconnect/probeSummary';
import { localDateKey } from '@/domain/time/localDate';
import { AppText } from '@/ui/components/AppText';

const INTERVAL_TYPES = [
  'Steps',
  'Distance',
  'ActiveCaloriesBurned',
  'TotalCaloriesBurned',
  'HeartRate',
  'SleepSession',
] as const satisfies readonly RecordType[];
const BODY_TYPES = ['Weight', 'BodyFat'] as const satisfies readonly RecordType[];
const SINCE = '2000-01-01T00:00:00Z';
const BODY_PAGE_SIZE = 1000;

function log(label: string, value: unknown): void {
  // eslint-disable-next-line no-console -- the controller reads these lines from logcat
  console.log(`HHPROBE ${label} ${JSON.stringify(value)}`);
}

/** The local day an interval record starts on, or null when the record has no usable start. */
function startDay(record: unknown): string | null {
  const startTime = (record as { startTime?: unknown } | undefined)?.startTime;
  if (typeof startTime !== 'string') return null;
  try {
    return localDateKey(startTime);
  } catch {
    return null;
  }
}

async function edgeDay(type: (typeof INTERVAL_TYPES)[number], ascendingOrder: boolean) {
  const { records } = await readRecords(type, {
    timeRangeFilter: { operator: 'after', startTime: SINCE },
    dataOriginFilter: [SAMSUNG_HEALTH_ORIGIN],
    pageSize: 1,
    ascendingOrder,
  });
  return startDay(records[0]);
}

async function runProbe(): Promise<void> {
  log('initialize', await initialize());
  await requestPermission([
    ...READ_RECORD_TYPES.map((recordType) => ({ accessType: 'read' as const, recordType })),
    { accessType: 'read' as const, recordType: 'ReadHealthDataHistory' as const },
  ]);
  const granted = await getGrantedPermissions();
  log(
    'granted',
    granted.map((permission) => permission.recordType),
  );

  for (const type of INTERVAL_TYPES) {
    log(`range.${type}`, {
      earliest: await edgeDay(type, true),
      latest: await edgeDay(type, false),
    });
  }

  for (const type of BODY_TYPES) {
    const records = await pageThrough(async (pageToken) =>
      readRecords(type, {
        timeRangeFilter: { operator: 'after', startTime: SINCE },
        pageSize: BODY_PAGE_SIZE,
        pageToken,
      }),
    );
    log(`origins.${type}`, summariseByOrigin(records, instantTimeOf));
    for (const origin of [MOVINGLIFE_ORIGIN, SAMSUNG_HEALTH_ORIGIN]) {
      log(`body.${type}.${origin}`, summariseBodyRecords(records, origin));
    }
  }
  log('done', true);
}

export function HealthConnectProbeScreen(): React.JSX.Element | null {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!__DEV__) return;
    runProbe().catch((error: unknown) => {
      log('error', error instanceof Error ? error.message : 'unknown error');
    });
  }, []);

  if (!__DEV__) return null;
  return (
    <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 16 }}>
      <AppText variant="title">Probe</AppText>
    </View>
  );
}
