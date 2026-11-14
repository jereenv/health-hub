import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildMetricDetail, parseMetricId } from '@/domain/body/metricDetail';
import { formatMetricChange, formatMetricValue } from '@/domain/body/formatMetric';
import { computeReadings } from '@/domain/body/readings';
import { METRIC_META } from '@/domain/body/types';
import type { MetricId } from '@/domain/body/types';
import { formatShortDate } from '@/domain/format/dates';
import type { RangeKind } from '@/domain/series/buckets';
import { localDateKey } from '@/domain/time/localDate';
import { AppText } from '@/ui/components/AppText';
import { Card } from '@/ui/components/Card';
import { DetailHeader } from '@/ui/components/DetailHeader';
import { EmptyState } from '@/ui/components/EmptyState';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { Skeleton } from '@/ui/components/Skeleton';
import { StatGroup } from '@/ui/components/StatGroup';
import { useBodyData } from '@/ui/data/useBodyData';
import { usePreferences } from '@/ui/data/useSyncSnapshot';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { RADIUS, SPACE } from '@/ui/theme/tokens';

import { BodyTrendChart } from './BodyTrendChart';
import { ExplainerCard } from './ExplainerCard';
import { OriginChip } from './OriginChip';
import { RangeBar } from './RangeBar';
import { rangeLabelFormatter } from './rangeLabels';
import { statusColor } from './statusColor';
import { TierBadge } from './TierBadge';

const RANGE_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
] as const;
const NO_VALUE = '—';
const IMPEDANCE_ONLY: readonly MetricId[] = [
  'water_pct',
  'muscle_pct',
  'bone_mass_kg',
  'protein_pct',
  'visceral_rating',
  'metabolic_age',
  'health_score',
];

function emptyBody(metric: MetricId): string {
  if (IMPEDANCE_ONLY.includes(metric)) {
    return `${METRIC_META[metric].label} needs a scale reading with impedance. It will appear once the scale connects directly.`;
  }
  return `${METRIC_META[metric].label} needs a weigh-in and your height, birth date and sex in Settings.`;
}

function rangeCaption(metric: MetricId, source: string): string {
  const basis =
    metric === 'weight' || metric === 'bmi'
      ? 'Ranges for your height.'
      : metric === 'body_fat_pct' || metric === 'muscle_pct' || metric === 'water_pct'
        ? 'Ranges for your age and sex.'
        : null;
  return [basis, `Source: ${source}.`].filter((part) => part !== null).join(' ');
}

export function MetricDetailScreen(): React.JSX.Element {
  const { metric: param } = useLocalSearchParams<{ metric: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { displayWeightUnit: unit } = usePreferences();
  const data = useBodyData();
  const [range, setRange] = useState<RangeKind>('day');
  const metric = parseMetricId(param);
  const today = localDateKey(new Date());

  const detail = useMemo(() => {
    if (metric === null || data.status !== 'ready') return null;
    const { readings, versions, watch } = data.data;
    const computed = computeReadings(readings, versions);
    const profile = versions[versions.length - 1] ?? null;
    return buildMetricDetail({ metric, readings: computed, profile, watch, range, today, unit });
  }, [metric, data, range, today, unit]);

  if (metric === null) {
    return (
      <View style={{ flex: 1 }}>
        <DetailHeader title="Body" />
        <EmptyState
          icon="body"
          title="Unknown metric"
          body="This body metric doesn't exist."
          action={{ label: 'Back', onPress: () => router.back() }}
        />
      </View>
    );
  }
  const label = METRIC_META[metric].label;
  if (data.status === 'error') {
    return (
      <View style={{ flex: 1 }}>
        <DetailHeader title={label} />
        <EmptyState
          icon="info"
          title="Couldn't load your body data"
          body="Something went wrong reading data on this phone."
          action={{ label: 'Back', onPress: () => router.back() }}
        />
      </View>
    );
  }
  if (detail === null) {
    return (
      <View style={{ flex: 1 }}>
        <DetailHeader title={label} />
        <View style={{ padding: SPACE.screen, gap: SPACE.stack }}>
          <Skeleton width="100%" height={120} radius={24} />
          <Skeleton width="100%" height={240} radius={24} />
        </View>
      </View>
    );
  }
  const { current, classified, series } = detail;
  if (current === null) {
    return (
      <View style={{ flex: 1 }}>
        <DetailHeader title={label} />
        <EmptyState
          icon="body"
          title={`No ${label.toLowerCase()} data yet`}
          body={emptyBody(metric)}
        />
      </View>
    );
  }

  const shown = formatMetricValue(metric, current.value, unit);
  const format = (value: number): string => formatMetricValue(metric, value, unit).value;
  const stats = series.stats;
  const statValue = (value: number | null): string => (value === null ? NO_VALUE : format(value));
  const statusText = classified?.statusLabel ?? detail.descriptor;
  const tone = classified?.band.status ?? null;
  const unitText = shown.unit === '' ? '' : ` ${shown.unit}`;

  return (
    <View style={{ flex: 1 }}>
      <DetailHeader title={label} />
      <ScrollView
        contentContainerStyle={{
          padding: SPACE.screen,
          paddingBottom: insets.bottom + SPACE.screen,
          gap: SPACE.stack,
        }}
      >
        <View style={{ gap: 10 }}>
          <AppText variant="hero" numeric>
            {shown.value}
            {shown.unit === '' ? null : (
              <AppText variant="heroUnit" color="muted">{` ${shown.unit}`}</AppText>
            )}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {statusText === null ? null : (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: RADIUS.pill,
                  backgroundColor: colors.raised,
                }}
              >
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
                <AppText variant="label">{statusText}</AppText>
              </View>
            )}
            <TierBadge tier={detail.tier} />
            <OriginChip origin={current.origin} />
          </View>
          {current.date === today ? null : (
            <AppText variant="caption" color="muted">
              {`Last measured ${formatShortDate(current.date)}`}
            </AppText>
          )}
        </View>

        {detail.range === null ? null : (
          <Card style={{ padding: SPACE.card, gap: SPACE.row }}>
            <RangeBar
              range={detail.range}
              value={current.value}
              formatLabel={rangeLabelFormatter(metric, unit)}
              accessibilityLabel={`${shown.value}${unitText} sits in the ${statusText ?? 'current'} zone`}
            />
            <AppText variant="caption" color="muted">
              {rangeCaption(metric, detail.range.source)}
            </AppText>
          </Card>
        )}

        <SegmentedControl
          options={RANGE_OPTIONS}
          value={range}
          onChange={setRange}
          accessibilityLabel="Chart range"
        />
        <Card style={{ padding: SPACE.card }}>
          <BodyTrendChart
            series={series}
            range={range}
            today={today}
            watch={detail.watch ?? undefined}
            formatValue={format}
            title={label}
            height={200}
          />
        </Card>
        <AppText variant="caption" color="muted">
          Each day shows its first weigh-in.
        </AppText>

        <StatGroup
          items={[
            { label: 'Average', value: statValue(stats?.average ?? null) },
            { label: 'Lowest', value: statValue(stats?.lowest ?? null) },
            { label: 'Highest', value: statValue(stats?.highest ?? null) },
            {
              label: 'Change',
              value:
                stats?.change == null ? NO_VALUE : formatMetricChange(metric, stats.change, unit),
            },
          ]}
        />
        {series.mixed ? (
          <AppText variant="caption" color="muted">
            Same-method readings only
          </AppText>
        ) : null}

        <ExplainerCard metric={metric} sources={detail.sources} origin={current.origin} />

        {detail.tip === null ? null : (
          <Card style={{ padding: SPACE.card, borderRadius: RADIUS.tile }}>
            <AppText variant="body">{detail.tip}</AppText>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
