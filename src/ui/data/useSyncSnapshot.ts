import { useSyncExternalStore } from 'react';

import { useContainer } from '@/bootstrap/ContainerContext';
import type { Preferences } from '@/data/settings/preferences';
import type { SyncSnapshot } from '@/data/sync/syncCoordinator';

export function useSyncSnapshot(): SyncSnapshot {
  const { sync } = useContainer();
  return useSyncExternalStore(sync.subscribe, sync.getSnapshot);
}

export function usePreferences(): Preferences {
  const { preferences } = useContainer();
  return useSyncExternalStore(preferences.subscribe, preferences.getSnapshot);
}
