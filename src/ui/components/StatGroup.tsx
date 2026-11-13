import { View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { RADIUS, SPACE } from '../theme/tokens';
import { AppText } from './AppText';
import { Card } from './Card';

export function StatGroup({
  items,
}: {
  items: readonly { label: string; value: string; unit?: string }[];
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Card style={{ borderRadius: RADIUS.tile, flexDirection: 'row', padding: SPACE.card }}>
      {items.map((item, index) => (
        <View
          key={item.label}
          accessible
          accessibilityLabel={`${item.label}, ${item.value}${item.unit === undefined ? '' : ` ${item.unit}`}`}
          style={{
            flex: 1,
            gap: 4,
            paddingLeft: index === 0 ? 0 : SPACE.card,
            borderLeftWidth: index === 0 ? 0 : 1,
            borderLeftColor: colors.line,
          }}
        >
          <AppText variant="caption" color="muted">
            {item.label}
          </AppText>
          <AppText variant="stat">
            {item.value}
            {item.unit === undefined ? null : (
              <AppText variant="label" color="muted">
                {` ${item.unit}`}
              </AppText>
            )}
          </AppText>
        </View>
      ))}
    </Card>
  );
}
