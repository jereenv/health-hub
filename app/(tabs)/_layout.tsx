import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/ui/navigation/TabBar';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="(today)" />
      <Tabs.Screen name="body" />
      <Tabs.Screen name="workouts" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="export" />
    </Tabs>
  );
}
