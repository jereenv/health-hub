import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDayMonth } from '@/domain/format/dates';
import { formatCount } from '@/domain/format/numbers';
import { formatVolume, formatWeight, formatWeightNumber } from '@/domain/format/units';
import type { RangeKind } from '@/domain/series/buckets';
import { localDateKey } from '@/domain/time/localDate';
import { EPLEY_NOTE } from '@/domain/workouts/metrics';
import { buildExerciseProgress } from '@/domain/workouts/progress';
import { TrendChart } from '@/ui/charts/TrendChart';
import { ActionRow } from '@/ui/components/ActionRow';
import { AppText } from '@/ui/components/AppText';
import { BottomSheet } from '@/ui/components/BottomSheet';
import { Card } from '@/ui/components/Card';
import { DetailHeader } from '@/ui/components/DetailHeader';
import { EmptyState } from '@/ui/components/EmptyState';
import { IconButton } from '@/ui/components/IconButton';
import { SectionCard } from '@/ui/components/SectionCard';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { Skeleton } from '@/ui/components/Skeleton';
import { StatGroup } from '@/ui/components/StatGroup';
import { useWorkoutData } from '@/ui/data/useAppData';
import { usePreferences } from '@/ui/data/useSyncSnapshot';
import { parseIdParam } from '@/ui/navigation/params';
import { SPACE } from '@/ui/theme/tokens';

import { toChartData } from './chartData';

const RANGE_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
] as const;
const RANGE_CAPTIONS: Record<RangeKind, string> = {
  day: 'Last 30 days',
  week: 'Last 12 weeks',
  month: 'All time',
};

export function ExerciseProgressScreen(): React.JSX.Element {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { displayWeightUnit: unit } = usePreferences();
  const data = useWorkoutData();
  const [range, setRange] = useState<RangeKind>('week');
  const [showInfo, setShowInfo] = useState(false);
  const id = parseIdParam(exerciseId);
  const today = localDateKey(new Date());

  if (data.status === 'loading') {
    return (
      <View style={{ flex: 1 }}>
        <DetailHeader title="Exercise" />
        <View style={{ padding: SPACE.screen, gap: SPACE.stack }}>
          <Skeleton width="100%" height={120} radius={24} />
          <Skeleton width="100%" height={200} radius={24} />
        </View>
      </View>
    );
  }
  const progress =
    data.status === 'ready' && id !== null
      ? buildExerciseProgress(data.data, id, range, today)
      : null;
  if (progress === null) {
    return (
      <View style={{ flex: 1 }}>
        <DetailHeader title="Exercise" />
        <EmptyState
          icon="dumbbell"
          title="Exercise not found"
          body="It may have been deleted in Lyfta."
          action={{ label: 'Back', onPress: () => router.back() }}
        />
      </View>
    );
  }

  const { bestE1rm, bestWeight } = progress;
  const hasScoredSets = bestE1rm !== null || bestWeight !== null;
  return (
    <View style={{ flex: 1 }}>
      <DetailHeader
        title={progress.name}
        right={
          <IconButton
            icon="info"
            accessibilityLabel="How 1-rep max is estimated"
            onPress={() => setShowInfo(true)}
          />
        }
      />
      {!hasScoredSets ? (
        <EmptyState
          icon="dumbbell"
          title="No weighted sets for this exercise"
          body="Completed sets with weight and reps will chart here."
        />
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: SPACE.screen,
            paddingBottom: insets.bottom + SPACE.screen,
            gap: SPACE.stack,
          }}
        >
          {bestE1rm === null ? null : (
            <View style={{ gap: 4 }}>
              <AppText variant="label" color="muted">
                Estimated 1-rep max
              </AppText>
              <AppText variant="hero" numeric>
                {formatWeightNumber(bestE1rm.kg, unit)}
                <AppText variant="heroUnit" color="muted">{` ${unit}`}</AppText>
              </AppText>
              <AppText variant="caption" color="muted" numeric>
                Set on {formatDayMonth(bestE1rm.date)} · {formatWeight(bestE1rm.weightKg, unit)} ×{' '}
                {bestE1rm.reps}
              </AppText>
            </View>
          )}
          <StatGroup
            items={[
              {
                label: 'Best weight',
                value: bestWeight === null ? '—' : formatWeight(bestWeight.kg, unit),
              },
              { label: 'Sessions', value: String(progress.sessions) },
              { label: 'Last done', value: formatDayMonth(progress.lastDate) },
            ]}
          />
          <SegmentedControl
            options={RANGE_OPTIONS}
            value={range}
            onChange={setRange}
            accessibilityLabel="Chart range"
          />
          <Card style={{ padding: SPACE.card, gap: SPACE.row }}>
            <AppText variant="section" color="muted">
              Estimated 1-rep max
            </AppText>
            <TrendChart
              kind="line"
              data={toChartData(progress.e1rmSeries, range, today)}
              formatValue={(kg) => formatWeight(kg, unit)}
              title="Estimated 1-rep max"
              caption={RANGE_CAPTIONS[range]}
              showValueAxis
            />
          </Card>
          <Card style={{ padding: SPACE.card, gap: SPACE.row }}>
            <AppText variant="section" color="muted">
              Volume
            </AppText>
            <TrendChart
              kind="bar"
              data={toChartData(progress.volumeSeries, range, today)}
              formatValue={(kg) => formatVolume(kg, unit)}
              title="Volume"
              caption={RANGE_CAPTIONS[range]}
              showValueAxis
            />
          </Card>
          <SectionCard label="Recent sessions">
            {progress.recent.map((session, index) => (
              <ActionRow
                key={session.lyftaId}
                title={formatDayMonth(session.date)}
                subtitle={
                  session.topSet === null
                    ? formatCount(session.scoredSets, 'set')
                    : `${formatWeight(session.topSet.weightKg, unit)} × ${session.topSet.reps}`
                }
                value={formatVolume(session.volumeKg, unit)}
                trailing="chevron"
                divider={index < progress.recent.length - 1}
                onPress={() => router.push(`/workouts/${session.lyftaId}`)}
              />
            ))}
          </SectionCard>
          <AppText variant="caption" color="muted">
            {EPLEY_NOTE}
          </AppText>
        </ScrollView>
      )}
      {showInfo ? (
        <BottomSheet open onClose={() => setShowInfo(false)} title="Formula sources">
          <AppText variant="body" color="muted">
            {EPLEY_NOTE}
          </AppText>
        </BottomSheet>
      ) : null}
    </View>
  );
}
