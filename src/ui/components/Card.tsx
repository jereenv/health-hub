import { View } from 'react-native';
import type { ViewProps } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { RADIUS } from '../theme/tokens';

/** A bordered surface. No shadow: depth comes from the surface colour. */
export function Card({
  surface = 'card',
  style,
  ...rest
}: ViewProps & { surface?: 'card' | 'raised' }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors[surface],
          borderColor: colors.line,
          borderWidth: 1,
          borderRadius: RADIUS.card,
        },
        style,
      ]}
    />
  );
}
