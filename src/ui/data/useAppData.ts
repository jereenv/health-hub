import { useContainer } from '@/bootstrap/ContainerContext';
import { SECRET_KEYS } from '@/data/secrets/SecretStore';
import type { SyncState } from '@/data/sync/SyncStateRepository';
import type { Workout } from '@/domain/workouts/types';

import type { AsyncState } from './useAsyncData';
import { useAsyncData } from './useAsyncData';
import { useSyncSnapshot } from './useSyncSnapshot';

export interface LyftaStatus {
  hasKey: boolean;
  workouts: SyncState;
  schedule: SyncState;
}

/** The Lyfta key's presence and both sync states, re-read after every sync, re-sync or wipe. */
export function useLyftaStatus(): AsyncState<LyftaStatus> {
  const { secrets, syncState } = useContainer();
  const { dataVersion } = useSyncSnapshot();
  return useAsyncData(async () => {
    const [key, workouts, schedule] = await Promise.all([
      secrets.get(SECRET_KEYS.lyftaApiKey),
      syncState.get('lyfta'),
      syncState.get('lyfta_schedule'),
    ]);
    return { hasKey: key !== null && key !== '', workouts, schedule };
  }, [secrets, syncState, dataVersion]);
}

/** Every stored workout, re-read after every sync, re-sync or wipe. */
export function useWorkoutData(): AsyncState<Workout[]> {
  const { workouts } = useContainer();
  const { dataVersion } = useSyncSnapshot();
  return useAsyncData(() => workouts.listAll(), [workouts, dataVersion]);
}
