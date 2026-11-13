import { View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { SPACE, TOUCH_MIN } from '../theme/tokens';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

export function ActionRow({
  title,
  subtitle,
  subtitleTone = 'muted',
  value,
  leading,
  trailing = 'none',
  onPress,
  disabled = false,
  destructive = false,
  divider = false,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string;
  subtitleTone?: 'muted' | 'warning';
  value?: string;
  leading?: React.ReactNode;
  trailing?: 'chevron' | 'none';
  onPress?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  divider?: boolean;
  accessibilityLabel?: string;
}): React.JSX.Element {
  const { colors } = useTheme();
  const rowStyle = {
    minHeight: TOUCH_MIN + 12,
    paddingHorizontal: SPACE.card,
    paddingVertical: SPACE.row,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACE.row,
    borderBottomWidth: divider ? 1 : 0,
    borderBottomColor: colors.line,
    opacity: disabled ? 0.4 : 1,
  };
  const content = (
    <>
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong" color={destructive ? 'statusHigh' : 'ink'}>
          {title}
        </AppText>
        {subtitle === undefined ? null : (
          <AppText variant="caption" color={subtitleTone === 'warning' ? 'statusHigh' : 'muted'}>
            {subtitle}
          </AppText>
        )}
      </View>
      {value === undefined ? null : (
        <AppText variant="body" color="muted" numeric>
          {value}
        </AppText>
      )}
      {trailing === 'chevron' ? (
        <Icon name="chevronRight" size={18} color={colors.muted} strokeWidth={2} />
      ) : null}
    </>
  );

  if (onPress === undefined) {
    return (
      <View accessible accessibilityLabel={accessibilityLabel} style={rowStyle}>
        {content}
      </View>
    );
  }
  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={rowStyle}
    >
      {content}
    </PressableScale>
  );
}
