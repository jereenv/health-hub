import { View } from 'react-native';

import { TIER_LABEL } from '@/domain/body/formatMetric';
import type { Tier } from '@/domain/body/types';
import { AppText } from '@/ui/components/AppText';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { RADIUS } from '@/ui/theme/tokens';

/** How trustworthy a number is: Measured, Exact, Estimated or Rough. */
export function TierBadge({ tier }: { tier: Tier }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: RADIUS.pill,
        backgroundColor: colors.raised,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      <AppText variant="micro" color="muted">
        {TIER_LABEL[tier]}
      </AppText>
    </View>
  );
}
