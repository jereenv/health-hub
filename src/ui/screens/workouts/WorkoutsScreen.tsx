import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { useContainer } from '@/bootstrap/ContainerContext';
import { formatDayMonth } from '@/domain/format/dates';
import { formatDuration } from '@/domain/format/numbers';
import { formatVolume } from '@/domain/format/units';
import { addDays, localDateKey } from '@/domain/time/localDate';
import { HEAT_WEEKS } from '@/domain/workouts/history';
import { buildWorkoutsOverview, HISTORY_PAGE_WEEKS } from '@/domain/workouts/overview';
import { computePersonalRecords, prSetKeys } from '@/domain/workouts/records';
import { HeatStrip } from '@/ui/charts/HeatStrip';
import { TrendChart } from '@/ui/charts/TrendChart';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { EmptyState } from '@/ui/components/EmptyState';
import { ScreenHeader } from '@/ui/components/ScreenHeader';
import { Skeleton } from '@/ui/components/Skeleton';
import { StatGroup } from '@/ui/components/StatGroup';
import { useLyftaStatus, useWorkoutData } from '@/ui/data/useAppData';
import { useAsyncData } from '@/ui/data/useAsyncData';
import { usePreferences, useSyncSnapshot } from '@/ui/data/useSyncSnapshot';
import { useTabBarInset } from '@/ui/navigation/TabBar';
import { describeSyncStatus } from '@/ui/sync/syncStatusText';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { SPACE } from '@/ui/theme/tokens';

import { LatestWorkoutCard } from './LatestWorkoutCard';
import { TopLiftCard } from './TopLiftCard';
import { UpcomingCard } from './UpcomingCard';
import { WeekSection } from './WeekSection';

const UPCOMING_LOOKAHEAD_DAYS = 28;

function WorkoutsSkeleton(): React.JSX.Element {
  return (
    <View style={{ padding: SPACE.screen, gap: SPACE.stack }}>
      <Skeleton width="100%" height={72} radius={20} />
      <Skeleton width="100%" height={160} radius={24} />
      <Skeleton width="100%" height={120} radius={24} />
      <Skeleton width="100%" height={200} radius={24} />
      <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
        Fetching your Lyfta history…
      </AppText>
    </View>
  );
}

export function WorkoutsScreen(): React.JSX.Element {
  const router = useRouter();
  const { colors } = useTheme();
  const inset = useTabBarInset();
  const { sync, schedule } = useContainer();
  const snapshot = useSyncSnapshot();
  const { displayWeightUnit: unit } = usePreferences();
  const status = useLyftaStatus();
  const data = useWorkoutData();
  const today = localDateKey(new Date());
  const upcomingState = useAsyncData(
    () => schedule.listBetween(today, addDays(today, UPCOMING_LOOKAHEAD_DAYS)),
    [schedule, today, snapshot.dataVersion],
  );
  const [visibleWeeks, setVisibleWeeks] = useState(HISTORY_PAGE_WEEKS);

  const workouts = data.status === 'ready' ? data.data : null;
  const upcoming = upcomingState.status === 'ready' ? upcomingState.data : null;
  const records = useMemo(() => computePersonalRecords(workouts ?? []), [workouts]);
  const prKeys = useMemo(() => prSetKeys(records), [records]);
  const overview = useMemo(
    () =>
      workouts === null || upcoming === null
        ? null
        : buildWorkoutsOverview({ workouts, upcoming, records, today }),
    [workouts, upcoming, records, today],
  );

  const syncLine =
    status.status === 'ready'
      ? describeSyncStatus({
          state: status.data.workouts,
          running: snapshot.running,
          hasKey: status.data.hasKey,
          now: new Date(),
          noun: 'workout',
        })
      : null;
  const header = (
    <ScreenHeader
      title="Workouts"
      subtitle={syncLine === null ? 'From Lyfta' : `From Lyfta · ${syncLine.text}`}
      subtitleTone={syncLine?.tone}
    />
  );
  const body = (content: React.ReactNode): React.JSX.Element => (
    <ScrollView
      contentContainerStyle={{ paddingBottom: inset }}
      refreshControl={
        <RefreshControl
          refreshing={snapshot.running}
          onRefresh={() => void sync.run()}
          tintColor={colors.accentInk}
          colors={[colors.accentInk]}
          progressBackgroundColor={colors.raised}
        />
      }
    >
      {header}
      {content}
    </ScrollView>
  );

  if (data.status === 'error' || upcomingState.status === 'error') {
    return body(
      <EmptyState
        icon="info"
        title="Couldn't load your workouts"
        body="Something went wrong reading data on this phone."
        action={{ label: 'Try again', onPress: () => void sync.run() }}
      />,
    );
  }
  if (status.status === 'ready' && !status.data.hasKey) {
    return body(
      <EmptyState
        icon="dumbbell"
        title="Connect Lyfta"
        body="Add your Lyfta key in Settings to see your workouts."
        action={{ label: 'Open Settings', onPress: () => router.push('/settings') }}
      />,
    );
  }
  if (overview === null || workouts === null || (workouts.length === 0 && snapshot.running)) {
    return body(<WorkoutsSkeleton />);
  }
  if (workouts.length === 0) {
    return body(
      <EmptyState
        icon="dumbbell"
        title="No workouts on this phone yet"
        body="Sync to download your Lyfta history."
        action={{ label: 'Sync now', onPress: () => void sync.run() }}
      />,
    );
  }

  const { thisWeek, weeklyVolume, heat, latest, topLift, weeks } = overview;
  const chartData = weeklyVolume.map((point, index) => ({
    key: point.start,
    value: point.value,
    tooltipLabel: `Week of ${formatDayMonth(point.start)}`,
    axisLabel: index === weeklyVolume.length - 1 ? 'This week' : formatDayMonth(point.start),
  }));

  return body(
    <View style={{ padding: SPACE.screen, gap: SPACE.stack }}>
      <View style={{ gap: SPACE.stack }}>
        <StatGroup
          items={[
            { label: 'Sessions', value: String(thisWeek.sessions) },
            { label: 'Volume', value: formatVolume(thisWeek.volumeKg, unit) },
            {
              label: 'Time',
              value: thisWeek.durationS === null ? '—' : formatDuration(thisWeek.durationS),
            },
          ]}
        />
        <TrendChart
          kind="bar"
          data={chartData}
          formatValue={(kg) => formatVolume(kg, unit)}
          title="Weekly volume"
          caption="the last 8 weeks"
          height={72}
          highlightLast
        />
      </View>

      <Card style={{ padding: SPACE.card, gap: SPACE.row }}>
        <AppText variant="section" color="muted">
          Last {HEAT_WEEKS} weeks
        </AppText>
        <HeatStrip columns={heat} />
      </Card>

      {latest === null ? null : (
        <LatestWorkoutCard
          workout={latest}
          prCount={overview.latestPrCount}
          prKeys={prKeys}
          unit={unit}
          today={today}
        />
      )}
      {topLift === null ? null : <TopLiftCard lift={topLift} unit={unit} today={today} />}
      <UpcomingCard items={overview.upcoming} today={today} />

      {weeks.slice(0, visibleWeeks).map((week) => (
        <WeekSection key={week.weekStart} week={week} unit={unit} />
      ))}
      {weeks.length > visibleWeeks ? (
        <Button
          label="Show earlier weeks"
          variant="plain"
          onPress={() => setVisibleWeeks((count) => count + HISTORY_PAGE_WEEKS)}
        />
      ) : null}
    </View>,
  );
}
