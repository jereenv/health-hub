import { Text } from 'react-native';
import type { TextProps } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import type { TextVariant } from '../theme/typography';
import { TYPE } from '../theme/typography';

export type TextColor = 'ink' | 'muted' | 'accentInk' | 'onAccent' | 'statusHigh';

export function AppText({
  variant,
  color = 'ink',
  numeric = false,
  style,
  children,
  ...rest
}: TextProps & { variant: TextVariant; color?: TextColor; numeric?: boolean }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Text
      {...rest}
      style={[
        TYPE[variant],
        { color: colors[color] },
        numeric && { fontVariant: ['tabular-nums'] },
        variant === 'section' && { textTransform: 'uppercase' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
