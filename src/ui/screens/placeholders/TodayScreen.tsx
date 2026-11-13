import { useRouter } from 'expo-router';

import { formatWeekdayLong } from '@/domain/format/dates';
import { localDateKey } from '@/domain/time/localDate';
import { IconButton } from '@/ui/components/IconButton';

import { TabPlaceholder } from './TabPlaceholder';

export function TodayScreen(): React.JSX.Element {
  const router = useRouter();
  return (
    <TabPlaceholder
      title="Today"
      subtitle={formatWeekdayLong(localDateKey(new Date()))}
      right={
        <IconButton
          icon="settings"
          accessibilityLabel="Settings"
          onPress={() => router.push('/settings')}
        />
      }
      icon="home"
      emptyTitle="Your day at a glance"
      body="Weigh-ins, sleep and steps appear here once the scale and Health Connect are connected."
      action={{ label: 'See workouts', onPress: () => router.navigate('/workouts') }}
    />
  );
}
