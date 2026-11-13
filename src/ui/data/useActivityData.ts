import { useContainer } from '@/bootstrap/ContainerContext';
import type {
  ActivityDay,
  HeartRateDay,
  SleepSessionRow,
} from '@/data/healthconnect/HealthConnectRepository';

import type { AsyncState } from './useAsyncData';
import { useAsyncData } from './useAsyncData';
import { useSyncSnapshot } from './useSyncSnapshot';

export interface ActivityData {
  activity: ActivityDay[];
  sleep: SleepSessionRow[];
  heartRate: HeartRateDay[];
}

/** Every stored Health Connect activity, sleep and heart-rate row, re-read after every sync or wipe. */
export function useActivityData(): AsyncState<ActivityData> {
  const { healthConnect } = useContainer();
  const { dataVersion } = useSyncSnapshot();
  return useAsyncData(async () => {
    const [activity, sleep, heartRate] = await Promise.all([
      healthConnect.listActivityDays(),
      healthConnect.listSleepSessions(),
      healthConnect.listHeartRateDays(),
    ]);
    return { activity, sleep, heartRate };
  }, [healthConnect, dataVersion]);
}
