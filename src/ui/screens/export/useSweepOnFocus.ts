import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Ruling 11: files from an earlier share are swept whenever the tab gains focus (the tab stays
 * mounted, so sweeping on mount alone would happen once per app start). Never while a share is in
 * progress: the receiving app may still be reading the file.
 */
export function useSweepOnFocus(sweep: () => Promise<void>, isBusy: () => boolean): void {
  // The latest callbacks, so a new closure each render does not re-run the focus effect.
  const latest = useRef({ sweep, isBusy });
  useEffect(() => {
    latest.current = { sweep, isBusy };
  });
  useFocusEffect(
    useCallback(() => {
      if (latest.current.isBusy()) return;
      latest.current.sweep().catch(() => undefined);
    }, []),
  );
}
