import { View } from 'react-native';

import type { LossRate } from '@/domain/body/lossRate';
import type { MetricRange } from '@/domain/body/ranges';
import { formatWeightNumber } from '@/domain/format/units';
import type { WeightUnit } from '@/domain/workouts/types';
import { AppText } from '@/ui/components/AppText';
import { Card } from '@/ui/components/Card';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { SPACE } from '@/ui/theme/tokens';

import { RangeBar } from './RangeBar';
import { statusColor } from './statusColor';

const STATUS_TEXT: Record<LossRate['status'], string> = {
  gaining: 'Gaining',
  steady: 'Steady',
  slow: 'Slow',
  healthy: 'Healthy',
  fast: 'Fast',
};
const STATUS_TONE = {
  gaining: 'high',
  steady: null,
  slow: 'low',
  healthy: 'ok',
  fast: 'high',
} as const;

const LOSS_RANGE: MetricRange = {
  bands: [
    { label: 'Slow', from: null, to: 0.5, status: 'low' },
    { label: 'Healthy', from: 0.5, to: 1, status: 'ok' },
    { label: 'Fast', from: 1, to: null, status: 'high' },
  ],
  scaleMin: 0,
  scaleMax: 1.5,
  source: 'Helms et al., 2014',
  sourceId: 'helms2014',
};

/** The 4-week weight trend as kilograms and a share of body weight per week. */
export function LossRateCard({
  rate,
  unit,
}: {
  rate: LossRate;
  unit: WeightUnit;
}): React.JSX.Element {
  const { colors } = useTheme();
  const tone = STATUS_TONE[rate.status];
  const perWeek = `${formatWeightNumber(Math.abs(rate.kgPerWeek), unit)} ${unit} a week · ${Math.abs(rate.percentPerWeek).toFixed(1)}%`;
  const direction = rate.kgPerWeek < 0 ? 'gained' : 'lost';
  return (
    <Card style={{ padding: SPACE.card, gap: SPACE.row }}>
      <AppText variant="section" color="muted">
        4-week average
      </AppText>
      <View style={{ gap: 4 }}>
        <AppText variant="stat" numeric>
          {perWeek}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              borderWidth: tone === null ? 1.5 : 0,
              borderColor: colors.muted,
              backgroundColor: tone === null ? 'transparent' : statusColor(colors, tone),
            }}
          />
          <AppText variant="label">{STATUS_TEXT[rate.status]}</AppText>
        </View>
      </View>
      <RangeBar
        range={LOSS_RANGE}
        value={Math.max(0, rate.percentPerWeek)}
        accessibilityLabel={`${perWeek} ${direction}, ${STATUS_TEXT[rate.status]}`}
      />
      <AppText variant="caption" color="muted">
        Healthy 0.5–1% of body weight per week · Helms et al., 2014
      </AppText>
    </Card>
  );
}
