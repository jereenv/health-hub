import { ScrollView, View, useWindowDimensions } from 'react-native';

import { formatRelativeDay } from '@/domain/format/dates';
import { formatDuration } from '@/domain/format/numbers';
import { formatVolume } from '@/domain/format/units';
import type { DateKey } from '@/domain/time/localDate';
import { localDateKey } from '@/domain/time/localDate';
import { workoutVolumeKg } from '@/domain/workouts/metrics';
import type { WeightUnit, Workout } from '@/domain/workouts/types';
import { AppText } from '@/ui/components/AppText';
import { BottomSheet } from '@/ui/components/BottomSheet';
import { Icon } from '@/ui/components/Icon';
import { PressableScale } from '@/ui/components/PressableScale';
import { useTheme } from '@/ui/theme/ThemeProvider';

export const WORKOUT_CHOICES = 20;

export function workoutMeta(workout: Workout, today: DateKey, unit: WeightUnit): string {
  return [
    formatRelativeDay(localDateKey(workout.performedAt), today),
    ...(workout.durationS === null ? [] : [formatDuration(workout.durationS)]),
    formatVolume(workoutVolumeKg(workout), unit),
  ].join(' · ');
}

/** `workouts` is newest first; only the newest 20 are offered. */
export function WorkoutSheet({
  workouts,
  selectedId,
  today,
  unit,
  onPick,
  onClose,
}: {
  workouts: readonly Workout[];
  selectedId: number | null;
  today: DateKey;
  unit: WeightUnit;
  onPick: (id: number) => void;
  onClose: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  return (
    <BottomSheet open onClose={onClose} title="Choose a workout">
      <ScrollView style={{ maxHeight: height * 0.55 }} contentContainerStyle={{ gap: 8 }}>
        {workouts.slice(0, WORKOUT_CHOICES).map((workout) => (
          <PressableScale
            key={workout.lyftaId}
            accessibilityLabel={`${workout.title}, ${workoutMeta(workout, today, unit)}`}
            accessibilityState={{ selected: workout.lyftaId === selectedId }}
            onPress={() => onPick(workout.lyftaId)}
            style={{
              minHeight: 60,
              paddingHorizontal: 14,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: workout.lyftaId === selectedId ? colors.accentInk : colors.line,
            }}
          >
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{workout.title}</AppText>
              <AppText variant="caption" color="muted" numeric>
                {workoutMeta(workout, today, unit)}
              </AppText>
            </View>
            <Icon name="chevronRight" size={16} color={colors.muted} strokeWidth={2} />
          </PressableScale>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}
