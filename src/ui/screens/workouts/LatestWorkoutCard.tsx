import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { formatRelativeDay } from '@/domain/format/dates';
import { formatDuration } from '@/domain/format/numbers';
import { formatVolume } from '@/domain/format/units';
import { localDateKey, type DateKey } from '@/domain/time/localDate';
import { exerciseVolumeKg, workoutVolumeKg } from '@/domain/workouts/metrics';
import { prSetKey } from '@/domain/workouts/records';
import type { WeightUnit, Workout } from '@/domain/workouts/types';
import { AppText } from '@/ui/components/AppText';
import { Card } from '@/ui/components/Card';
import { Icon } from '@/ui/components/Icon';
import { PressableScale } from '@/ui/components/PressableScale';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { SPACE } from '@/ui/theme/tokens';

import { SetChip } from './SetChip';

export function LatestWorkoutCard({
  workout,
  prCount,
  prKeys,
  unit,
  today,
}: {
  workout: Workout;
  prCount: number;
  prKeys: ReadonlySet<string>;
  unit: WeightUnit;
  today: DateKey;
}): React.JSX.Element {
  const router = useRouter();
  const { colors } = useTheme();
  const meta = [
    formatRelativeDay(localDateKey(workout.performedAt), today),
    ...(workout.durationS === null ? [] : [formatDuration(workout.durationS)]),
    formatVolume(workoutVolumeKg(workout), unit),
  ].join(' · ');

  return (
    <Card style={{ padding: SPACE.card, gap: SPACE.stack }}>
      <PressableScale
        accessibilityLabel={`${workout.title}, ${meta}`}
        onPress={() => router.push(`/workouts/${workout.lyftaId}`)}
        style={{ gap: 4 }}
      >
        <AppText variant="label" color="muted">
          Latest · {meta}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.gap }}>
          <AppText variant="heading" style={{ flexShrink: 1 }}>
            {workout.title}
          </AppText>
          {prCount === 0 ? null : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="trophy" size={14} color={colors.accentInk} />
              <AppText variant="label" color="accentInk">
                {prCount} PR
              </AppText>
            </View>
          )}
        </View>
      </PressableScale>
      {workout.exercises.map((exercise) => (
        <View key={exercise.position} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.gap }}>
            <AppText variant="bodyStrong" style={{ flexShrink: 1 }}>
              {exercise.name}
            </AppText>
            <AppText variant="caption" color="muted" numeric>
              {exercise.sets.length} sets · {formatVolume(exerciseVolumeKg(exercise), unit)}
            </AppText>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {exercise.sets.map((set) => (
                <SetChip
                  key={set.position}
                  set={set}
                  unit={unit}
                  isPr={prKeys.has(prSetKey(workout.lyftaId, exercise.position, set.position))}
                />
              ))}
            </View>
          </ScrollView>
        </View>
      ))}
    </Card>
  );
}
