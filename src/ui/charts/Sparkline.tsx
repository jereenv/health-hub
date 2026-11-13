import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../theme/ThemeProvider';
import { linePath, valueDomain, xPositions, yScale } from './geometry';

/** A small 2px trend line with no axes, for stat cards. */
export function Sparkline({
  values,
  width,
  height,
  accessibilityLabel,
}: {
  values: readonly number[];
  width: number;
  height: number;
  accessibilityLabel: string;
}): React.JSX.Element {
  const { colors } = useTheme();
  const box = { width, height, top: 2, bottom: 2, left: 2, right: 2 };
  const y = yScale(valueDomain(values, { includeZero: false }), box);

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Svg width={width} height={height}>
        {values.length > 1 ? (
          <Path
            d={linePath(xPositions(values.length, box, 'line'), values.map(y))}
            stroke={colors.accentInk}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : null}
      </Svg>
    </View>
  );
}
