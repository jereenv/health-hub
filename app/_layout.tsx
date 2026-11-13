import { Stack } from 'expo-router';
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

function ThemedStack(): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
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
