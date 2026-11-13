import { useState } from 'react';
import { View } from 'react-native';

import { useContainer } from '@/bootstrap/ContainerContext';
import { AppText } from '@/ui/components/AppText';
import { BottomSheet } from '@/ui/components/BottomSheet';
import { Button } from '@/ui/components/Button';
import { SPACE } from '@/ui/theme/tokens';

export function WipeSheet({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { sync, workouts } = useContainer();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function wipe(): Promise<void> {
    setRunning(true);
    setError(null);
    await sync.wipe();
    // `wipe` swallows failures, so the only proof is that nothing is left.
    const remaining = await workouts.count().catch(() => -1);
    setRunning(false);
    if (remaining === 0) onClose();
    else setError("Couldn't wipe local data");
  }

  return (
    <BottomSheet open onClose={onClose} title="Wipe local data?">
      <View style={{ gap: SPACE.stack }}>
        <AppText variant="body" color="muted">
          Deletes all workouts, schedule, Health Connect data and sync history from this phone. Your
          Lyfta key, profile and settings stay. Re-sync brings the data back.
        </AppText>
        {error === null ? null : (
          <AppText variant="caption" color="statusHigh">
            {error}
          </AppText>
        )}
        <Button
          label="Wipe data"
          variant="destructive"
          disabled={running}
          onPress={() => void wipe()}
        />
        <Button label="Cancel" variant="plain" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}
