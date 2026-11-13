import { useTheme } from '../theme/ThemeProvider';
import { TOUCH_MIN } from '../theme/tokens';
import { Icon } from './Icon';
import type { IconName } from './iconPaths';
import { PressableScale } from './PressableScale';

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
}: {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={{
        width: TOUCH_MIN,
        height: TOUCH_MIN,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} color={colors.ink} />
    </PressableScale>
  );
}
