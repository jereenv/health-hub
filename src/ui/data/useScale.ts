import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useContainer } from '@/bootstrap/ContainerContext';
import type { OffReason, ScaleState } from '@/domain/scale/scaleSession';

export interface ScaleActions {
  retry(): void;
  fix(reason: OffReason): void;
}

/**
 * The Bluetooth scale session for the Today card. The scale is read in the foreground only:
 * the runner starts while the app is active and stops in any other state and on unmount.
 */
export function useScale(): { state: ScaleState; actions: ScaleActions } {
  const { scale } = useContainer();
  const state = useSyncExternalStore(scale.subscribe, scale.getState);

  useEffect(() => {
    if (AppState.currentState === 'active') scale.start();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') scale.start();
      else scale.stop();
    });
    return () => {
      subscription.remove();
      scale.stop();
    };
  }, [scale]);

  const actions = useMemo<ScaleActions>(
    () => ({
      retry: () => scale.retry(),
      fix: (reason) => {
        void scale.fixAndRetry(reason);
      },
    }),
    [scale],
  );

  return { state, actions };
}
