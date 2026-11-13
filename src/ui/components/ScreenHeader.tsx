import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SPACE } from '../theme/tokens';
import { AppText } from './AppText';

export function ScreenHeader({
  title,
  subtitle,
  subtitleTone = 'muted',
  right,
}: {
  title: string;
  subtitle?: string;
  subtitleTone?: 'muted' | 'warning';
  right?: React.ReactNode;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top + 16,
        paddingHorizontal: SPACE.screen,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flex: 1 }}>
        {subtitle === undefined ? null : (
          <AppText variant="label" color={subtitleTone === 'warning' ? 'statusHigh' : 'muted'}>
            {subtitle}
          </AppText>
        )}
        <AppText variant="display" accessibilityRole="header">
          {title}
        </AppText>
      </View>
      {right}
    </View>
  );
}
