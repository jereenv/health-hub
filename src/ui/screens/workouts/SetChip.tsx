import { View } from 'react-native';

import type { WeightUnit, WorkoutSet } from '@/domain/workouts/types';
import { AppText } from '@/ui/components/AppText';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { RADIUS } from '@/ui/theme/tokens';

import { describeSetChip } from './setChipText';

export function SetChip({
  set,
  unit,
  isPr,
}: {
  set: WorkoutSet;
  unit: WeightUnit;
  isPr: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  const chip = describeSetChip(set, unit, isPr);
  return (
    <View
      accessible
      accessibilityLabel={chip.accessibilityLabel}
      style={{
        minWidth: 76,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: RADIUS.set,
        borderWidth: 1,
        borderColor: chip.tone === 'pr' ? colors.accentInk : colors.line,
        backgroundColor: colors.raised,
      }}
    >
      <AppText variant="bodyStrong" numeric>
        {chip.main}
      </AppText>
      <AppText variant="micro" color={chip.tone === 'pr' ? 'accentInk' : 'muted'}>
        {chip.sub}
      </AppText>
    </View>
  );
}
