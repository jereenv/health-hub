import { View } from 'react-native';

import { formatRelativeDay } from '@/domain/format/dates';
import { parseDateKey, weekdayIndex, type DateKey } from '@/domain/time/localDate';
import type { ScheduledWorkout } from '@/domain/workouts/schedule';
import { AppText } from '@/ui/components/AppText';
import { ActionRow } from '@/ui/components/ActionRow';
import { SectionCard } from '@/ui/components/SectionCard';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { RADIUS } from '@/ui/theme/tokens';

const WEEKDAY_LETTERS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function DateTile({ date }: { date: DateKey }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: RADIUS.chip,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: colors.muted,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AppText variant="micro" color="muted">
        {WEEKDAY_LETTERS[weekdayIndex(date)]}
      </AppText>
      <AppText variant="label" numeric>
        {parseDateKey(date).day}
      </AppText>
    </View>
  );
}

export function UpcomingCard({
  items,
  today,
}: {
  items: readonly ScheduledWorkout[];
  today: DateKey;
}): React.JSX.Element {
  return (
    <SectionCard label="Upcoming">
      {items.length === 0 ? (
        <ActionRow title="No upcoming workouts in Lyfta" />
      ) : (
        items.map((item, index) => (
          <ActionRow
            key={item.lyftaId}
            title={item.title}
            subtitle={formatRelativeDay(item.date, today)}
            leading={<DateTile date={item.date} />}
            divider={index < items.length - 1}
          />
        ))
      )}
    </SectionCard>
  );
}
