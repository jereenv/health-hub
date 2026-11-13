import { View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { SPACE } from '../theme/tokens';
import { AppText } from './AppText';
import { Button } from './Button';
import { Icon } from './Icon';
import type { IconName } from './iconPaths';

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: SPACE.row, padding: SPACE.screen }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        <Icon name={icon} size={24} color={colors.muted} />
      </View>
      <AppText variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      <AppText variant="body" color="muted" style={{ textAlign: 'center' }}>
        {body}
      </AppText>
      {action === undefined ? null : (
        <Button label={action.label} onPress={action.onPress} variant="secondary" />
      )}
    </View>
  );
}
