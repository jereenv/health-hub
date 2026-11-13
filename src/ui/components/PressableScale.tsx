import { Pressable } from 'react-native';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { MOTION } from '../theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A pressable that shrinks slightly while held, the app's one press feedback. */
export function PressableScale({
  style,
  onPressIn,
  onPressOut,
  ...rest
}: PressableProps & { style?: StyleProp<ViewStyle> }): React.JSX.Element {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...rest}
      onPressIn={(event) => {
        scale.set(withTiming(MOTION.pressScale, { duration: MOTION.pressMs }));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withTiming(1, { duration: MOTION.pressMs }));
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    />
  );
}
