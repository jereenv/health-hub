import { BlurTargetView, BlurView } from 'expo-blur';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '../theme/ThemeProvider';
import { MOTION } from '../theme/tokens';
import { AppText } from './AppText';
import { SheetContext } from './BottomSheet';
import type { SheetContent, SheetRegistry } from './BottomSheet';
import { shouldDismiss } from './sheetGesture';

const HANDLE = { width: 36, height: 5, radius: 3 } as const;

function Sheet({ content, visible }: { content: SheetContent; visible: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const height = useSharedValue(800);
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, { duration: MOTION.sheetMs });
  }, [visible, progress]);

  const { onClose } = content;
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      drag.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (shouldDismiss(e.translationY, e.velocityY)) scheduleOnRN(onClose);
      else drag.value = withTiming(0, { duration: MOTION.sheetMs });
    });

  const slide = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * height.value + drag.value }],
  }));
  const backdrop = useAnimatedStyle(() => ({ opacity: progress.value }));
  const padding = useAnimatedStyle(() => ({
    paddingBottom: insets.bottom + 16 + keyboard.height.value,
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, backdrop]}>
        <Pressable
          accessibilityLabel="Close"
          accessibilityRole="button"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
        />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        onLayout={(e) => {
          height.value = e.nativeEvent.layout.height;
        }}
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.raised,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderTopWidth: 1,
            borderColor: colors.line,
            paddingHorizontal: 20,
          },
          padding,
          slide,
        ]}
      >
        <GestureDetector gesture={pan}>
          <View style={{ paddingTop: 10, paddingBottom: 12, alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: HANDLE.width,
                height: HANDLE.height,
                borderRadius: HANDLE.radius,
                backgroundColor: colors.muted,
                opacity: 0.4,
              }}
            />
            {content.title !== undefined ? (
              <AppText variant="title" accessibilityRole="header">
                {content.title}
              </AppText>
            ) : null}
          </View>
        </GestureDetector>
        {content.children}
      </Animated.View>
    </View>
  );
}

/** Wraps the navigator in a blur target and draws the active sheet above it. */
export function SheetHost({ children }: { children: ReactNode }): React.JSX.Element {
  const { scheme } = useTheme();
  const targetRef = useRef<View>(null);
  const [content, setContent] = useState<SheetContent | null>(null);
  const [visible, setVisible] = useState(false);
  const unmountTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (unmountTimer.current !== null) clearTimeout(unmountTimer.current);
    unmountTimer.current = null;
  }, []);

  const registry = useMemo<SheetRegistry>(
    () => ({
      show: (next) => {
        clearTimer();
        setContent(next);
        setVisible(true);
      },
      hide: () => {
        setVisible(false);
        clearTimer();
        // Keep the last content mounted while the slide-out finishes.
        unmountTimer.current = setTimeout(() => setContent(null), MOTION.sheetMs + 50);
      },
    }),
    [clearTimer],
  );

  useEffect(() => clearTimer, [clearTimer]);

  const onClose = content?.onClose;
  useEffect(() => {
    if (!visible || onClose === undefined) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  return (
    <SheetContext.Provider value={registry}>
      <View style={{ flex: 1 }}>
        <BlurTargetView
          ref={targetRef}
          style={{ flex: 1 }}
          importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}
        >
          {children}
        </BlurTargetView>
        {content !== null ? (
          <>
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <BlurView
                blurTarget={targetRef}
                blurMethod="dimezisBlurViewSdk31Plus"
                intensity={40}
                tint={scheme}
                style={StyleSheet.absoluteFill}
              />
            </View>
            <Sheet content={content} visible={visible} />
          </>
        ) : null}
      </View>
    </SheetContext.Provider>
  );
}
