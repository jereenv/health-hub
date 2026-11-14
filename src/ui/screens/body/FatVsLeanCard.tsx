import { View } from 'react-native';

import type { FatVsLean } from '@/domain/body/fatVsLean';
import { formatMetricChange } from '@/domain/body/formatMetric';
import type { WeightUnit } from '@/domain/workouts/types';
import { AppText } from '@/ui/components/AppText';
import { Card } from '@/ui/components/Card';
import { StatGroup } from '@/ui/components/StatGroup';
import { SPACE } from '@/ui/theme/tokens';

/** How the last 30 days of change split between fat mass and lean mass. */
export function FatVsLeanCard({
  data,
  unit,
}: {
  data: FatVsLean;
  unit: WeightUnit;
}): React.JSX.Element {
  const { fatShareOfLoss } = data;
  return (
    <Card style={{ padding: SPACE.card, gap: SPACE.row }}>
      <AppText variant="section" color="muted">
        Fat vs lean mass
      </AppText>
      <AppText variant="caption" color="muted">
        Last 30 days
      </AppText>
      <StatGroup
        items={[
          { label: 'Fat mass', value: formatMetricChange('fat_mass_kg', data.fatChangeKg, unit) },
          {
            label: 'Lean mass',
            value: formatMetricChange('lean_mass_kg', data.leanChangeKg, unit),
          },
        ]}
      />
      {fatShareOfLoss === null ? null : (
        <View style={{ gap: 2 }}>
          <AppText variant="body">
            {`About ${Math.round(fatShareOfLoss * 100)}% of what you lost was fat.`}
          </AppText>
          {fatShareOfLoss > 0.5 ? (
            <AppText variant="body" color="muted">
              Keep protein up and keep lifting.
            </AppText>
          ) : null}
        </View>
      )}
      {data.hollow ? (
        <AppText variant="caption" color="muted">
          From MovingLife body fat
        </AppText>
      ) : null}
    </Card>
  );
}
