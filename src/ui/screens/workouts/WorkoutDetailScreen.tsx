import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatShortDate } from '@/domain/format/dates';
import { formatCount, formatDuration } from '@/domain/format/numbers';
import { formatVolume } from '@/domain/format/units';
import { buildWorkoutDetail } from '@/domain/workouts/detail';
import { computePersonalRecords, prSetKeys } from '@/domain/workouts/records';
import { AppText } from '@/ui/components/AppText';
import { Card } from '@/ui/components/Card';
import { DetailHeader } from '@/ui/components/DetailHeader';
import { EmptyState } from '@/ui/components/EmptyState';
import { Icon } from '@/ui/components/Icon';
import { PressableScale } from '@/ui/components/PressableScale';
import { Skeleton } from '@/ui/components/Skeleton';
import { useWorkoutData } from '@/ui/data/useAppData';
import { usePreferences } from '@/ui/data/useSyncSnapshot';
import { parseIdParam } from '@/ui/navigation/params';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { SPACE } from '@/ui/theme/tokens';

import { SetChip } from './SetChip';

export function WorkoutDetailScreen(): React.JSX.Element {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { displayWeightUnit: unit } = usePreferences();
  const data = useWorkoutData();
  const id = parseIdParam(workoutId);
  const workouts = data.status === 'ready' ? data.data : null;
  const prKeys = useMemo(() => prSetKeys(computePersonalRecords(workouts ?? [])), [workouts]);

  const workout = workouts?.find((w) => w.lyftaId === id) ?? null;
  if (workouts === null && data.status === 'loading') {
    return (
      <View style={{ flex: 1 }}>
        <DetailHeader title="Workout" />
        <View style={{ padding: SPACE.screen, gap: SPACE.stack }}>
          <Skeleton width="100%" height={80} radius={24} />
          <Skeleton width="100%" height={160} radius={24} />
        </View>
      </View>
    );
  }
  if (workout === null) {
    return (
      <View style={{ flex: 1 }}>
        <DetailHeader title="Workout" />
        <EmptyState
          icon="dumbbell"
          title="Workout not found"
          body="It may have been deleted in Lyfta."
          action={{ label: 'Back to Workouts', onPress: () => router.back() }}
        />
      </View>
    );
  }

  const detail = buildWorkoutDetail(workout, prKeys);
  const meta = [
    formatCount(detail.exerciseCount, 'exercise'),
    formatCount(detail.setCount, 'set'),
    ...(detail.durationS === null ? [] : [formatDuration(detail.durationS)]),
    formatVolume(detail.volumeKg, unit),
    ...(detail.prCount === 0 ? [] : [formatCount(detail.prCount, 'PR')]),
  ].join(' · ');

  return (
    <View style={{ flex: 1 }}>
      <DetailHeader title={formatShortDate(detail.date)} />
      <ScrollView
        contentContainerStyle={{
          padding: SPACE.screen,
          paddingBottom: insets.bottom + SPACE.screen,
          gap: SPACE.stack,
        }}
      >
        <View style={{ gap: 4 }}>
          <AppText variant="title" accessibilityRole="header">
            {detail.title}
          </AppText>
          <AppText variant="label" color="muted" numeric>
            {meta}
          </AppText>
        </View>
        {detail.exercises.map((exercise) => (
          <Card key={exercise.position} style={{ padding: SPACE.card, gap: SPACE.row }}>
            <PressableScale
              accessibilityLabel={`${exercise.name}, open progress`}
              onPress={() => router.push(`/workouts/exercise/${exercise.exerciseId}`)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.gap }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyStrong">{exercise.name}</AppText>
                <AppText variant="caption" color="muted" numeric>
                  {formatCount(exercise.sets.length, 'set')} ·{' '}
                  {formatVolume(exercise.volumeKg, unit)}
                </AppText>
              </View>
              <Icon name="chevronRight" size={18} color={colors.muted} strokeWidth={2} />
            </PressableScale>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {exercise.sets.map(({ set, isPr }) => (
                <SetChip key={set.position} set={set} unit={unit} isPr={isPr} />
              ))}
            </View>
          </Card>
        ))}
        <AppText variant="caption" color="muted">
          PR: heavier than any earlier session of this exercise, or a higher estimated 1-rep max.
        </AppText>
      </ScrollView>
    </View>
  );
}
