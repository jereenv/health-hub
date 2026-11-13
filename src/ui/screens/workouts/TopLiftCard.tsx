import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { formatSinceLabel } from '@/domain/format/dates';
import { formatSignedDelta } from '@/domain/format/numbers';
import { formatWeightNumber, kgToUnit } from '@/domain/format/units';
import type { DateKey } from '@/domain/time/localDate';
import type { TopLift } from '@/domain/workouts/overview';
import type { WeightUnit } from '@/domain/workouts/types';
import { Sparkline } from '@/ui/charts/Sparkline';
import { AppText } from '@/ui/components/AppText';
import { Card } from '@/ui/components/Card';
import { PressableScale } from '@/ui/components/PressableScale';
import { SPACE } from '@/ui/theme/tokens';

export function TopLiftCard({
  lift,
  unit,
  today,
}: {
  lift: TopLift;
  unit: WeightUnit;
  today: DateKey;
}): React.JSX.Element {
  const router = useRouter();
  const change =
    lift.deltaKg === null || lift.since === null
      ? null
      : `${formatSignedDelta(kgToUnit(lift.deltaKg, unit), 1)} ${unit} ${formatSinceLabel(lift.since, today)}`;
  const value = `${formatWeightNumber(lift.latestE1rmKg, unit)} ${unit}`;

  return (
    <PressableScale
      accessibilityLabel={`${lift.name}, estimated 1-rep max ${value}${change === null ? '' : `, ${change}`}`}
      onPress={() => router.push(`/workouts/exercise/${lift.exerciseId}`)}
    >
      <Card
        style={{
          padding: SPACE.card,
          flexDirection: 'row',
          alignItems: 'center',
          gap: SPACE.stack,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="label" color="muted">
            {lift.name} · estimated 1-rep max
          </AppText>
          <AppText variant="stat" numeric>
            {value}
          </AppText>
          {change === null ? null : (
            <AppText variant="caption" color="muted" numeric>
              {change}
            </AppText>
          )}
        </View>
        <Sparkline
          values={lift.series.map((kg) => kgToUnit(kg, unit))}
          width={72}
          height={32}
          accessibilityLabel={`${lift.series.length} sessions of estimated 1-rep max`}
        />
      </Card>
    </PressableScale>
  );
}
