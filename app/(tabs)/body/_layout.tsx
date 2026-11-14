import { Stack } from 'expo-router';

import { useTheme } from '@/ui/theme/ThemeProvider';

export default function BodyLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
  );
}
