import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/ui/navigation/TabBar';
import { useTheme } from '@/ui/theme/ThemeProvider';

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tabs.Screen name="(today)" />
      <Tabs.Screen name="body" />
      <Tabs.Screen name="workouts" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="export" />
    </Tabs>
  );
}
