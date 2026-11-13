import { View } from 'react-native';

import { RADIUS, SPACE } from '../theme/tokens';
import { AppText } from './AppText';
import { Card } from './Card';
import { PressableScale } from './PressableScale';

export function StatCard({
  label,
  value,
  unit,
  caption,
  onPress,
}: {
  label: string;
  value: string;
  unit?: string;
  caption?: string;
  onPress?: () => void;
}): React.JSX.Element {
  const content = (
    <Card style={{ borderRadius: RADIUS.tile, padding: SPACE.card, gap: 10 }}>
      <AppText variant="label" color="muted">
        {label}
      </AppText>
      <AppText variant="stat">
        {value}
        {unit === undefined ? null : (
          <AppText variant="label" color="muted">
            {` ${unit}`}
          </AppText>
        )}
      </AppText>
      {caption === undefined ? null : (
        <AppText variant="caption" color="muted" numeric>
          {caption}
        </AppText>
      )}
    </Card>
  );
  if (onPress === undefined) return <View>{content}</View>;
  return (
    <PressableScale
      accessibilityLabel={`${label}, ${value}${unit === undefined ? '' : ` ${unit}`}`}
      onPress={onPress}
    >
      {content}
    </PressableScale>
  );
}
