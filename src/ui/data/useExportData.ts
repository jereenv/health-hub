import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import type { AppContainer } from '@/bootstrap/container';
import { useContainer } from '@/bootstrap/ContainerContext';
import type { ExportData } from '@/domain/export/types';

import type { AsyncState } from './useAsyncData';
import { useAsyncData } from './useAsyncData';
import { useSyncSnapshot } from './useSyncSnapshot';

/** Wide enough to hold every stored schedule item. */
const SCHEDULE_FROM = '2000-01-01';
const SCHEDULE_TO = '2100-12-31';

/** Every stored row the briefing reads. The briefing itself is built by the screen. */
export async function loadExportData(
  c: Pick<AppContainer, 'workouts' | 'schedule' | 'body' | 'profile' | 'healthConnect'>,
): Promise<ExportData> {
  const [workouts, schedule, readings, versions, watch, activity, sleep, heartRate] =
    await Promise.all([
      c.workouts.listAll(),
      c.schedule.listBetween(SCHEDULE_FROM, SCHEDULE_TO),
      c.body.listReadings(),
      c.profile.listVersions(),
      c.healthConnect.listWatchBodyFat(),
      c.healthConnect.listActivityDays(),
      c.healthConnect.listSleepSessions(),
      c.healthConnect.listHeartRateDays(),
    ]);
  return { workouts, schedule, readings, versions, watch, activity, sleep, heartRate };
}

/** Re-read after every sync or wipe and whenever the screen regains focus (Ruling 18). */
export function useExportData(): AsyncState<ExportData> {
  const container = useContainer();
  const { dataVersion } = useSyncSnapshot();
  const [focusCount, setFocusCount] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setFocusCount((count) => count + 1);
    }, []),
  );
  const { workouts, schedule, body, profile, healthConnect } = container;
  return useAsyncData(
    () => loadExportData({ workouts, schedule, body, profile, healthConnect }),
    [workouts, schedule, body, profile, healthConnect, dataVersion, focusCount],
  );
}
