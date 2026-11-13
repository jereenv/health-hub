import type { ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { RADIUS, TOUCH_MIN } from '../theme/tokens';
import type { TextColor } from './AppText';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'plain';

const LABEL_COLOR: Record<ButtonVariant, TextColor> = {
  primary: 'onAccent',
  secondary: 'ink',
  destructive: 'statusHigh',
  plain: 'accentInk',
};

export function Button({
  label,
  onPress,
  variant,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant: ButtonVariant;
  disabled?: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  const surface: ViewStyle =
    variant === 'primary'
      ? { backgroundColor: colors.accent }
      : variant === 'secondary'
        ? { backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line }
        : variant === 'destructive'
          ? { backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.statusHigh }
          : {};

  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        {
          minHeight: TOUCH_MIN,
          paddingHorizontal: 20,
          borderRadius: RADIUS.pill,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : 1,
        },
        surface,
      ]}
    >
      <AppText variant="bodyStrong" color={LABEL_COLOR[variant]}>
        {label}
      </AppText>
    </PressableScale>
  );
}
