import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { useContainer } from '@/bootstrap/ContainerContext';
import { buildActivitySeries } from '@/domain/activity/activitySeries';
import { buildHeartRateSummary } from '@/domain/activity/heartRate';
import { formatInteger } from '@/domain/format/numbers';
import { formatDistance } from '@/domain/format/units';
import type { RangeKind } from '@/domain/series/buckets';
import { localDateKey } from '@/domain/time/localDate';
import { EmptyState } from '@/ui/components/EmptyState';
import { ScreenHeader } from '@/ui/components/ScreenHeader';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { useActivityData } from '@/ui/data/useActivityData';
import { useHealthConnectStatus } from '@/ui/data/useAppData';
import { usePreferences, useSyncSnapshot } from '@/ui/data/useSyncSnapshot';
import { useTabBarInset } from '@/ui/navigation/TabBar';
import { describeHealthConnectStatus } from '@/ui/screens/settings/healthConnectText';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { SPACE } from '@/ui/theme/tokens';

import { ActivityMetricCard } from './ActivityMetricCard';
import { ActivitySkeleton } from './ActivitySkeleton';
import { HeartRateCard } from './HeartRateCard';
import { SleepCard } from './SleepCard';

const RANGE_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
] as const;

const formatSteps = (steps: number): string => formatInteger(steps);
const formatKcal = (kcal: number): string => `${formatInteger(kcal)} kcal`;

export function ActivityScreen(): React.JSX.Element {
  const router = useRouter();
  const { colors } = useTheme();
  const inset = useTabBarInset();
  const { sync } = useContainer();
  const snapshot = useSyncSnapshot();
  const { displayWeightUnit: unit } = usePreferences();
  const status = useHealthConnectStatus();
  const data = useActivityData();
  const [range, setRange] = useState<RangeKind>('week');
  const today = localDateKey(new Date());

  const rows = data.status === 'ready' ? data.data : null;
  const series = useMemo(
    () =>
      rows === null
        ? null
        : {
            steps: buildActivitySeries(rows.activity, 'steps', range, today),
            distance: buildActivitySeries(rows.activity, 'distanceM', range, today),
            calories: buildActivitySeries(rows.activity, 'totalKcal', range, today),
            heartRate: buildHeartRateSummary(rows.heartRate, range, today),
          },
    [rows, range, today],
  );

  const line =
    status.status === 'ready'
      ? describeHealthConnectStatus({
          ...status.data,
          running: snapshot.running,
          now: new Date(),
        })
      : null;
  const header = (
    <ScreenHeader
      title="Activity"
      subtitle={line === null ? 'From Samsung Health' : `From Samsung Health · ${line.text}`}
      subtitleTone={line?.tone}
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

  if (data.status === 'error') {
    return body(
      <EmptyState
        icon="info"
        title="Couldn't load your activity"
        body="Something went wrong reading data on this phone."
        action={{ label: 'Try again', onPress: () => void sync.run() }}
      />,
    );
  }
  if (status.status === 'ready') {
    const { availability, access } = status.data.connection;
    if (availability !== 'available' || access === null || !access.readAll) {
      return body(
        <EmptyState
          icon="activity"
          title="Connect Health Connect"
          body="Allow access in Settings to see your steps, sleep and heart rate from Samsung Health."
          action={{ label: 'Open Settings', onPress: () => router.push('/settings') }}
        />,
      );
    }
  }
  if (rows === null || series === null || status.status !== 'ready') {
    return body(<ActivitySkeleton />);
  }
  if (rows.activity.length === 0 && rows.sleep.length === 0 && rows.heartRate.length === 0) {
    return snapshot.running
      ? body(<ActivitySkeleton />)
      : body(
          <EmptyState
            icon="activity"
            title="No Samsung Health data yet"
            body="Sync to import your activity from Health Connect."
            action={{ label: 'Sync now', onPress: () => void sync.run() }}
          />,
        );
  }

  return body(
    <View style={{ padding: SPACE.screen, gap: SPACE.stack }}>
      <SegmentedControl
        options={RANGE_OPTIONS}
        value={range}
        onChange={setRange}
        accessibilityLabel="Chart range"
      />
      <ActivityMetricCard
        title="Steps"
        series={series.steps}
        range={range}
        today={today}
        formatValue={formatSteps}
        emptyText="No steps recorded"
      />
      <ActivityMetricCard
        title="Distance"
        series={series.distance}
        range={range}
        today={today}
        formatValue={(meters) => formatDistance(meters, unit)}
        emptyText="No distance recorded"
        note="Samsung Health records distance on only some days."
      />
      <ActivityMetricCard
        title="Calories"
        series={series.calories}
        range={range}
        today={today}
        formatValue={formatKcal}
        emptyText="No calories recorded"
        note="Total includes resting burn."
      />
      <SleepCard sessions={rows.sleep} range={range} today={today} />
      <HeartRateCard summary={series.heartRate} range={range} today={today} />
    </View>,
  );
}
