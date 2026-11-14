import { useRouter } from 'expo-router';
import { ScrollView } from 'react-native';

import { formatWeekdayLong } from '@/domain/format/dates';
import { localDateKey } from '@/domain/time/localDate';
import { EmptyState } from '@/ui/components/EmptyState';
import { IconButton } from '@/ui/components/IconButton';
import { ScreenHeader } from '@/ui/components/ScreenHeader';
import { usePreferences } from '@/ui/data/useSyncSnapshot';
import { useScale } from '@/ui/data/useScale';
import { useTabBarInset } from '@/ui/navigation/TabBar';
import { ScaleCard } from '@/ui/screens/today/ScaleCard';

export function TodayScreen(): React.JSX.Element {
  const router = useRouter();
  const inset = useTabBarInset();
  const { displayWeightUnit } = usePreferences();
  const { state, actions } = useScale();
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: inset }}>
      <ScreenHeader
        title="Today"
        subtitle={formatWeekdayLong(localDateKey(new Date()))}
        right={
          <IconButton
            icon="settings"
            accessibilityLabel="Settings"
            onPress={() => router.push('/settings')}
          />
        }
      />
      <ScaleCard
        state={state}
        unit={displayWeightUnit}
        handlers={{ ...actions, openBody: () => router.navigate('/body') }}
      />
      <EmptyState
        icon="home"
        title="Your day at a glance"
        body="Weigh-ins, sleep and steps appear here once the scale and Health Connect are connected."
        action={{ label: 'See workouts', onPress: () => router.navigate('/workouts') }}
      />
    </ScrollView>
  );
}
