import { View } from 'react-native';

import { DetailHeader } from '@/ui/components/DetailHeader';
import { EmptyState } from '@/ui/components/EmptyState';

/** Placeholder until the Settings task fills it in. */
export function SettingsScreen(): React.JSX.Element {
  return (
    <View style={{ flex: 1 }}>
      <DetailHeader title="Settings" />
      <EmptyState
        icon="settings"
        title="Settings"
        body="Lyfta, units and data controls arrive next."
      />
    </View>
  );
}
