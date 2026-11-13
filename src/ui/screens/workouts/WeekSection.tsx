import { useRouter } from 'expo-router';

import { formatShortDate, formatWeekRange } from '@/domain/format/dates';
import { formatDuration } from '@/domain/format/numbers';
import { formatVolume } from '@/domain/format/units';
import { localDateKey } from '@/domain/time/localDate';
import type { OverviewWeek, WeekLabel } from '@/domain/workouts/overview';
import { workoutVolumeKg } from '@/domain/workouts/metrics';
import type { WeightUnit } from '@/domain/workouts/types';
import { ActionRow } from '@/ui/components/ActionRow';
import { AppText } from '@/ui/components/AppText';
import { SectionCard } from '@/ui/components/SectionCard';

const FIXED_LABELS: Record<Exclude<WeekLabel, 'range'>, string> = {
  earlier_this_week: 'Earlier this week',
  last_week: 'Last week',
};

export function WeekSection({
  week,
  unit,
}: {
  week: OverviewWeek;
  unit: WeightUnit;
}): React.JSX.Element {
  const router = useRouter();
  const label = week.label === 'range' ? formatWeekRange(week.weekStart) : FIXED_LABELS[week.label];
  const totals = [
    String(week.sessions),
    formatVolume(week.volumeKg, unit),
    ...(week.durationS === null ? [] : [formatDuration(week.durationS)]),
  ].join(' · ');

  return (
    <SectionCard
      label={label}
      right={
        <AppText variant="caption" color="muted" numeric>
          {totals}
        </AppText>
      }
    >
      {week.rows.map((workout, index) => (
        <ActionRow
          key={workout.lyftaId}
          title={workout.title}
          subtitle={[
            formatShortDate(localDateKey(workout.performedAt)),
            ...(workout.durationS === null ? [] : [formatDuration(workout.durationS)]),
          ].join(' · ')}
          value={formatVolume(workoutVolumeKg(workout), unit)}
          trailing="chevron"
          divider={index < week.rows.length - 1}
          onPress={() => router.push(`/workouts/${workout.lyftaId}`)}
        />
      ))}
    </SectionCard>
  );
}
