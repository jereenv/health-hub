import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useContainer } from '@/bootstrap/ContainerContext';
import type { BodyReading } from '@/data/body/BodyRepository';
import type { WatchBodyFat } from '@/data/healthconnect/HealthConnectRepository';
import type { Profile } from '@/domain/profile/profile';

import type { AsyncState } from './useAsyncData';
import { useAsyncData } from './useAsyncData';
import { useSyncSnapshot } from './useSyncSnapshot';

export interface BodyData {
  readings: BodyReading[];
  versions: Profile[];
  watch: WatchBodyFat[];
}

/**
 * Every stored weigh-in, profile version and watch check, re-read after every sync or wipe and
 * whenever the screen regains focus, so a profile edit in Settings shows at once (Ruling 14).
 */
export function useBodyData(): AsyncState<BodyData> {
  const { body, profile, healthConnect } = useContainer();
  const { dataVersion } = useSyncSnapshot();
  const [focusCount, setFocusCount] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setFocusCount((count) => count + 1);
    }, []),
  );
  return useAsyncData(async () => {
    const [readings, versions, watch] = await Promise.all([
      body.listReadings(),
      profile.listVersions(),
      healthConnect.listWatchBodyFat(),
    ]);
    return { readings, versions, watch };
  }, [body, profile, healthConnect, dataVersion, focusCount]);
}
