import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ContainerProvider } from '@/bootstrap/ContainerContext';
import { SheetHost } from '@/ui/components/SheetHost';
import { ThemeProvider, useTheme } from '@/ui/theme/ThemeProvider';

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
          <SheetHost>
            <ThemedStack />
          </SheetHost>
        </ContainerProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
