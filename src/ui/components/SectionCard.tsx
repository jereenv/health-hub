import { View } from 'react-native';

import { SPACE } from '../theme/tokens';
import { AppText } from './AppText';
import { Card } from './Card';

/** A titled group: an optional label row above a card that holds rows or other content. */
export function SectionCard({
  label,
  right,
  children,
}: {
  label?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={{ gap: SPACE.gap }}>
      {label === undefined && right === undefined ? null : (
        <View
          style={{
            paddingHorizontal: SPACE.gap,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <AppText variant="section" color="muted" accessibilityRole="header">
            {label}
          </AppText>
          {right}
        </View>
      )}
      <Card style={{ overflow: 'hidden' }}>{children}</Card>
    </View>
  );
}
