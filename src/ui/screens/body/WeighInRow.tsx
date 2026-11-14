import { View } from 'react-native';

import type { WeighInModel } from '@/domain/body/bodyOverview';
import { formatShortDate } from '@/domain/format/dates';
import { formatWeight } from '@/domain/format/units';
import type { WeightUnit } from '@/domain/workouts/types';
import { AppText } from '@/ui/components/AppText';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { SPACE, TOUCH_MIN } from '@/ui/theme/tokens';

import { formatClockTime } from './weighInText';

/** One weigh-in: date and time, weight, and body fat with a hollow dot when it is MovingLife's. */
export function WeighInRow({
  weighIn,
  unit,
  divider,
}: {
  weighIn: WeighInModel;
  unit: WeightUnit;
  divider: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  const bodyFat = weighIn.bodyFatPct === null ? null : `${weighIn.bodyFatPct.toFixed(1)}% body fat`;
  const date = formatShortDate(weighIn.date);
  const weight = formatWeight(weighIn.weightKg, unit);
  return (
    <View
      accessible
      accessibilityLabel={[
        `${date}, ${formatClockTime(weighIn.measuredAt)}`,
        weight,
        bodyFat === null ? null : `${bodyFat}${weighIn.bodyFatHollow ? ', from MovingLife' : ''}`,
      ]
        .filter((part) => part !== null)
        .join(', ')}
      style={{
        minHeight: TOUCH_MIN + 4,
        paddingHorizontal: SPACE.card,
        paddingVertical: SPACE.row,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: colors.line,
      }}
    >
      <View style={{ gap: 2 }}>
        <AppText variant="bodyStrong">{date}</AppText>
        <AppText variant="caption" color="muted" numeric>
          {formatClockTime(weighIn.measuredAt)}
        </AppText>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <AppText variant="bodyStrong" numeric>
          {weight}
        </AppText>
        {bodyFat === null ? null : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                borderWidth: weighIn.bodyFatHollow ? 1.5 : 0,
                borderColor: colors.muted,
                backgroundColor: weighIn.bodyFatHollow ? 'transparent' : colors.muted,
              }}
            />
            <AppText variant="caption" color="muted" numeric>
              {bodyFat}
            </AppText>
          </View>
        )}
      </View>
    </View>
  );
}
