import { useState } from 'react';
import { View } from 'react-native';

import { useContainer } from '@/bootstrap/ContainerContext';
import type { SyncState } from '@/data/sync/SyncStateRepository';
import { AppText } from '@/ui/components/AppText';
import { BottomSheet } from '@/ui/components/BottomSheet';
import { Button } from '@/ui/components/Button';
import type { HealthConnectConnection } from '@/ui/data/useAppData';
import { SPACE } from '@/ui/theme/tokens';

import { describeHealthConnectStatus } from './healthConnectText';

const RETRY_HINT = "Allow every data type, including 'Access past data'";

/** Shows the Health Connect connection and asks for the read permissions. */
export function HealthConnectSheet({
  connection,
  state,
  running,
  onChanged,
  onPrivacy,
  onClose,
}: {
  connection: HealthConnectConnection;
  state: SyncState;
  running: boolean;
  /** Called after any permission request so the caller re-reads the connection. */
  onChanged: () => void;
  onPrivacy: () => void;
  onClose: () => void;
}): React.JSX.Element {
  const { healthConnectGateway, sync } = useContainer();
  const [requesting, setRequesting] = useState(false);
  const [incomplete, setIncomplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = describeHealthConnectStatus({ connection, state, running, now: new Date() });
  const { access } = connection;
  const complete = access !== null && access.readAll && access.history;

  async function requestAccess(): Promise<void> {
    setRequesting(true);
    setError(null);
    try {
      const result = await healthConnectGateway.requestAccess();
      setIncomplete(!result.readAll || !result.history);
      onChanged();
      if (result.readAll) void sync.run();
    } catch {
      setError("Couldn't ask Health Connect for access");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <BottomSheet open onClose={onClose} title="Health Connect">
      <View style={{ gap: SPACE.stack }}>
        <AppText variant="bodyStrong" color={status.tone === 'warning' ? 'statusHigh' : 'muted'}>
          {status.text}
        </AppText>
        <AppText variant="body" color="muted">
          Health Hub reads your steps, distance, calories, heart rate, sleep, weight and body fat
          from Health Connect to show your trends and build the summary you choose to export. It
          never writes to Health Connect.
        </AppText>
        {!incomplete ? null : (
          <AppText variant="caption" color="statusHigh">
            {RETRY_HINT}
          </AppText>
        )}
        {error === null ? null : (
          <AppText variant="caption" color="statusHigh">
            {error}
          </AppText>
        )}
        {complete || connection.availability !== 'available' ? null : (
          <Button
            label="Allow access"
            variant="primary"
            disabled={requesting}
            onPress={() => void requestAccess()}
          />
        )}
        <Button
          label="Open Health Connect settings"
          variant="secondary"
          onPress={() => healthConnectGateway.openSettings()}
        />
        <Button label="Privacy" variant="plain" onPress={onPrivacy} />
      </View>
    </BottomSheet>
  );
}
