import { View } from 'react-native';

import type { BandStatus } from '@/domain/body/ranges';
import type { Tier } from '@/domain/body/types';
import { AppText } from '@/ui/components/AppText';
import { Icon } from '@/ui/components/Icon';
import { PressableScale } from '@/ui/components/PressableScale';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { SPACE, TOUCH_MIN } from '@/ui/theme/tokens';

import { statusColor } from './statusColor';
import { TierBadge } from './TierBadge';

/**
 * One metric on the Body page. The dot is filled in the status colour when the metric has a range
 * and hollow when it only has a neutral descriptor; the text always says what the dot means.
 */
export function MetricRow({
  label,
  tier,
  value,
  unit,
  status,
  statusText,
  divider = false,
  onPress,
}: {
  label: string;
  tier: Tier;
  value: string;
  unit: string;
  status: BandStatus | null;
  statusText: string;
  divider?: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`${label}, ${[value, unit].filter(Boolean).join(' ')}, ${statusText}`}
      style={{
        minHeight: TOUCH_MIN + 12,
        paddingHorizontal: SPACE.card,
        paddingVertical: SPACE.row,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACE.row,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: colors.line,
      }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <AppText variant="bodyStrong">{label}</AppText>
        <TierBadge tier={tier} />
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
          <AppText variant="heading" numeric>
            {value}
          </AppText>
          {unit === '' ? null : (
            <AppText variant="caption" color="muted">
              {unit}
            </AppText>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              borderWidth: status === null ? 1.5 : 0,
              borderColor: colors.muted,
              backgroundColor: status === null ? 'transparent' : statusColor(colors, status),
            }}
          />
          <AppText variant="caption" color="muted">
            {statusText}
          </AppText>
        </View>
      </View>
      <Icon name="chevronRight" size={18} color={colors.muted} />
    </PressableScale>
  );
}
