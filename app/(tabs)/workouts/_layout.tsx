import { Stack } from 'expo-router';

import { useTheme } from '@/ui/theme/ThemeProvider';

export default function WorkoutsLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
  );
}
