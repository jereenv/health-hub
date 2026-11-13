import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider';
import { MOTION } from '../theme/tokens';

const PULSE_LOW = 0.35;

/** A placeholder block that pulses while content loads; static when reduced motion is on. */
export function Skeleton({
  width,
  height,
  radius = 12,
}: {
  width: number | `${number}%`;
  height: number;
  radius?: number;
}): React.JSX.Element {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) {
      opacity.set(1);
      return;
    }
    const half = MOTION.pulseMs / 2;
    opacity.set(
      withRepeat(
        withSequence(withTiming(PULSE_LOW, { duration: half }), withTiming(1, { duration: half })),
        -1,
      ),
    );
  }, [opacity, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.track },
        animatedStyle,
      ]}
    />
  );
}
