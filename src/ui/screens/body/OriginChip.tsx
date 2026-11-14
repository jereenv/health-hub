import { View } from 'react-native';

import { ORIGIN_LABEL } from '@/domain/body/formatMetric';
import type { Origin } from '@/domain/body/types';
import { AppText } from '@/ui/components/AppText';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { RADIUS } from '@/ui/theme/tokens';

/** Names where a number came from when it did not come from the scale or our own formulas. */
export function OriginChip({ origin }: { origin: Origin }): React.JSX.Element | null {
  const { colors } = useTheme();
  const label = ORIGIN_LABEL[origin];
  if (label === null) return null;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
    </View>
  );
}
