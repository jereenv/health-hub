import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { useContainer } from '@/bootstrap/ContainerContext';
import { buildBodyOverview } from '@/domain/body/bodyOverview';
import type { MetricRowModel } from '@/domain/body/bodyOverview';
import { formatMetricChange, formatMetricValue } from '@/domain/body/formatMetric';
import { computeReadings, profileAt } from '@/domain/body/readings';
import { METRIC_META } from '@/domain/body/types';
import { formatWeightNumber } from '@/domain/format/units';
import { localDateKey } from '@/domain/time/localDate';
import { Sparkline } from '@/ui/charts/Sparkline';
import { AppText } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { EmptyState } from '@/ui/components/EmptyState';
import { PressableScale } from '@/ui/components/PressableScale';
import { ScreenHeader } from '@/ui/components/ScreenHeader';
import { SectionCard } from '@/ui/components/SectionCard';
import { useBodyData } from '@/ui/data/useBodyData';
import { useHealthConnectStatus } from '@/ui/data/useAppData';
import { usePreferences, useSyncSnapshot } from '@/ui/data/useSyncSnapshot';
import { useTabBarInset } from '@/ui/navigation/TabBar';
import { HEALTH_CONNECT_CHECK_FAILED } from '@/ui/screens/settings/healthConnectText';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { RADIUS, SPACE } from '@/ui/theme/tokens';

import { BodySkeleton } from './BodySkeleton';
import { FatVsLeanCard } from './FatVsLeanCard';
import { LossRateCard } from './LossRateCard';
import { MetricRow } from './MetricRow';
import { TierBadge } from './TierBadge';
import { WeighInRow } from './WeighInRow';
import { lastWeighInText } from './weighInText';

const SPARK_WIDTH = 96;
const SPARK_HEIGHT = 40;
const NO_RANGE_TEXT = 'No range yet';
const LEGACY_NOTE =
  'MovingLife only shares weight and body fat, so water, muscle and the other metrics appear once the scale connects directly.';

function rowTexts(row: MetricRowModel): { status: MetricRowModel['statusTone']; text: string } {
  return { status: row.statusTone, text: row.statusLabel ?? row.descriptor ?? NO_RANGE_TEXT };
}

export function BodyScreen(): React.JSX.Element {
  const router = useRouter();
  const { colors } = useTheme();
  const inset = useTabBarInset();
  const { sync } = useContainer();
  const snapshot = useSyncSnapshot();
  const { displayWeightUnit: unit } = usePreferences();
  const [statusVersion, setStatusVersion] = useState(0);
  const status = useHealthConnectStatus(statusVersion);
  const data = useBodyData();
  const today = localDateKey(new Date());

  const overview = useMemo(() => {
    if (data.status !== 'ready') return null;
    const { readings, versions } = data.data;
    const computed = computeReadings(readings, versions);
    const latest = computed[computed.length - 1];
    const profile = latest === undefined ? null : profileAt(versions, latest.measuredAt);
    return buildBodyOverview(computed, profile, today);
  }, [data, today]);

  const body = (content: React.ReactNode, subtitle?: string): React.JSX.Element => (
    <ScrollView
      contentContainerStyle={{ paddingBottom: inset }}
      refreshControl={
        <RefreshControl
          refreshing={snapshot.running}
          onRefresh={() => void sync.run()}
          tintColor={colors.accentInk}
          colors={[colors.accentInk]}
          progressBackgroundColor={colors.raised}
        />
      }
    >
      <ScreenHeader title="Body" subtitle={subtitle} />
      {content}
    </ScrollView>
  );

  if (data.status === 'error') {
    return body(
      <EmptyState
        icon="info"
        title="Couldn't load your body data"
        body="Something went wrong reading data on this phone."
        action={{ label: 'Try again', onPress: () => void sync.run() }}
      />,
    );
  }
  if (overview === null || overview.latest === null) {
    if (data.status === 'loading' || status.status === 'loading') return body(<BodySkeleton />);
    if (status.status === 'error') {
      return body(
        <EmptyState
          icon="info"
          title={HEALTH_CONNECT_CHECK_FAILED}
          body="Health Connect didn't answer. Your imported data is still on this phone."
          action={{ label: 'Try again', onPress: () => setStatusVersion((v) => v + 1) }}
        />,
      );
    }
    const { availability, access } = status.data.connection;
    if (availability !== 'available' || access === null || !access.readAll) {
      return body(
        <EmptyState
          icon="body"
          title="Connect Health Connect"
          body="Allow access in Settings to see your weigh-ins from Health Connect."
          action={{ label: 'Open Settings', onPress: () => router.push('/settings') }}
        />,
      );
    }
    return snapshot.running
      ? body(<BodySkeleton />)
      : body(
          <EmptyState
            icon="body"
            title="No weigh-ins yet"
            body="Sync to import your weigh-ins from Health Connect."
            action={{ label: 'Sync now', onPress: () => void sync.run() }}
          />,
        );
  }

  const { latest, weightChange30, weightSpark, rows, lossRate, fatVsLean, recent, missing } =
    overview;
  const weightKg = latest.metrics.weight?.value ?? 0;
  const weightText = formatWeightNumber(weightKg, unit);
  const changeText =
    weightChange30 === null
      ? null
      : `${formatMetricChange('weight', weightChange30, unit)} in 30 days`;

  return body(
    <View style={{ padding: SPACE.screen, gap: SPACE.stack }}>
      {missing.length === 0 ? null : (
        <Card style={{ padding: SPACE.card, gap: SPACE.row, borderRadius: RADIUS.tile }}>
          <AppText variant="body">
            Add your height, birth date and sex in Settings to unlock BMI and ranges
          </AppText>
          <Button
            label="Open Settings"
            variant="secondary"
            onPress={() => router.push('/settings')}
          />
        </Card>
      )}

      <PressableScale
        onPress={() => router.push('/body/weight')}
        accessibilityLabel={`Weight, ${weightText} ${unit}${changeText === null ? '' : `, ${changeText}`}`}
      >
        <Card style={{ padding: SPACE.card, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <AppText variant="label" color="muted">
              Weight
            </AppText>
            <AppText variant="display" numeric>
              {weightText}
              <AppText variant="heroUnit" color="muted">{` ${unit}`}</AppText>
            </AppText>
            {changeText === null ? null : (
              <AppText variant="label" color="muted" numeric>
                {changeText}
              </AppText>
            )}
            <TierBadge tier="measured" />
          </View>
          <Sparkline
            values={weightSpark}
            width={SPARK_WIDTH}
            height={SPARK_HEIGHT}
            accessibilityLabel={`Weight over the last 30 days, ${weightSpark.length} weigh-in days`}
          />
        </Card>
      </PressableScale>

      {rows.length === 0 ? null : (
        <View style={{ gap: SPACE.gap }}>
          <SectionCard>
            {rows.map((row, index) => {
              const shown = formatMetricValue(row.id, row.value, unit);
              const { status: tone, text } = rowTexts(row);
              return (
                <MetricRow
                  key={row.id}
                  label={METRIC_META[row.id].label}
                  tier={row.tier}
                  value={shown.value}
                  unit={shown.unit}
                  status={tone}
                  statusText={text}
                  divider={index > 0}
                  onPress={() => router.push(`/body/${row.id}`)}
                />
              );
            })}
          </SectionCard>
          {overview.onlyLegacy ? (
            <AppText variant="caption" color="muted" style={{ paddingHorizontal: SPACE.gap }}>
              {LEGACY_NOTE}
            </AppText>
          ) : null}
        </View>
      )}

      {lossRate === null ? null : <LossRateCard rate={lossRate} unit={unit} />}
      {fatVsLean === null ? null : <FatVsLeanCard data={fatVsLean} unit={unit} />}

      <SectionCard
        label="Weigh-ins"
        right={
          <PressableScale
            onPress={() => router.push('/body/history')}
            accessibilityLabel="See all weigh-ins"
          >
            <AppText variant="label" color="accentInk">
              See all
            </AppText>
          </PressableScale>
        }
      >
        {recent.map((weighIn, index) => (
          <WeighInRow key={weighIn.readingId} weighIn={weighIn} unit={unit} divider={index > 0} />
        ))}
      </SectionCard>
    </View>,
    lastWeighInText(latest.measuredAt, today),
  );
}
