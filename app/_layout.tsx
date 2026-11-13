import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ContainerProvider, useContainer } from '@/bootstrap/ContainerContext';
import { SheetHost } from '@/ui/components/SheetHost';
import { ThemeProvider, useTheme } from '@/ui/theme/ThemeProvider';

/** Starts one Lyfta sync at launch; a remount shares the run already in flight. */
function LaunchSync(): null {
  const { sync } = useContainer();
  useEffect(() => {
    void sync.run();
  }, [sync]);
  return null;
}

/** Gives the navigator our colours; its default theme paints a light background behind scenes. */
function ThemedStack(): React.JSX.Element {
  const { scheme, colors } = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    dark: scheme === 'dark',
    colors: {
      ...base.colors,
      background: colors.bg,
      card: colors.card,
      text: colors.ink,
      border: colors.line,
      primary: colors.accent,
      notification: colors.accent,
    },
  };
  return (
    <NavigationThemeProvider value={navigationTheme}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <ContainerProvider>
          <LaunchSync />
          <SheetHost>
            <ThemedStack />
          </SheetHost>
        </ContainerProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
