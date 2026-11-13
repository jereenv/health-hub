import { useMemo } from 'react';
import { View } from 'react-native';

import {
  averageAsleepS,
  buildSleepNights,
  formatClock,
  sleepConsistency,
} from '@/domain/activity/sleepNights';
import type { SleepNight } from '@/domain/activity/sleepNights';
import { buildBucketedSeries } from '@/domain/activity/activitySeries';
import type { SleepSessionRow } from '@/data/healthconnect/HealthConnectRepository';
import { formatShortDate } from '@/domain/format/dates';
import { formatDuration } from '@/domain/format/numbers';
import type { RangeKind } from '@/domain/series/buckets';
import type { DateKey } from '@/domain/time/localDate';
import { TrendChart } from '@/ui/charts/TrendChart';
import { AppText } from '@/ui/components/AppText';
import { Card } from '@/ui/components/Card';
import { StatGroup } from '@/ui/components/StatGroup';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { SPACE } from '@/ui/theme/tokens';
import type { ThemeColors } from '@/ui/theme/tokens';

import { RANGE_CAPTIONS, toActivityChartData } from './chartData';

const NO_VALUE = '—';
const CONSISTENCY_NIGHTS = 14;
const LIST_NIGHTS = 7;

interface Stage {
  label: string;
  seconds: number;
  color: keyof ThemeColors;
}

function stagesOf(night: SleepNight): Stage[] | null {
  if (night.lightS === null && night.deepS === null && night.remS === null) return null;
  return [
    { label: 'Light', seconds: night.lightS ?? 0, color: 'bar' },
    { label: 'Deep', seconds: night.deepS ?? 0, color: 'accent' },
    { label: 'REM', seconds: night.remS ?? 0, color: 'statusLow' },
    { label: 'Awake', seconds: night.awakeS, color: 'track' },
  ];
}

function nightLine(night: SleepNight): string {
  const deep = night.deepS === null ? '' : ` · Deep ${formatDuration(night.deepS)}`;
  return `${formatShortDate(night.date)} · ${formatDuration(night.asleepS)}${deep}`;
}

export function SleepCard({
  sessions,
  range,
  today,
}: {
  sessions: readonly SleepSessionRow[];
  range: RangeKind;
  today: DateKey;
}): React.JSX.Element {
  const { colors } = useTheme();
  const nights = useMemo(() => buildSleepNights(sessions), [sessions]);
  const points = useMemo(
    () =>
      buildBucketedSeries(
        nights.map((n) => ({ date: n.date, value: n.asleepS })),
        range,
        today,
        true,
      ),
    [nights, range, today],
  );

  const latest = nights[nights.length - 1];
  if (latest === undefined) {
    return (
      <Card style={{ padding: SPACE.card, gap: SPACE.row }}>
        <AppText variant="section" color="muted">
          Sleep
        </AppText>
        <AppText variant="body" color="muted">
          No sleep recorded yet
        </AppText>
      </Card>
    );
  }

  const recent = nights.slice(-CONSISTENCY_NIGHTS);
  const consistency = sleepConsistency(recent);
  const average = averageAsleepS(recent);
  const stages = stagesOf(latest);
  const stageTotal = stages === null ? 0 : stages.reduce((sum, s) => sum + s.seconds, 0);
  const hasChartData = points.some((p) => p.count > 0);

  return (
    <Card style={{ padding: SPACE.card, gap: SPACE.row }}>
      <AppText variant="section" color="muted">
        Sleep
      </AppText>
      <View style={{ gap: 2 }}>
        <AppText variant="caption" color="muted">
          {latest.date === today ? 'Last night' : formatShortDate(latest.date)}
        </AppText>
        <AppText variant="hero" numeric>
          {formatDuration(latest.asleepS)}
        </AppText>
      </View>
      {stages === null || stageTotal === 0 ? null : (
        <View style={{ gap: SPACE.gap }}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              flexDirection: 'row',
              height: 12,
              borderRadius: 6,
              overflow: 'hidden',
              gap: 2,
            }}
          >
            {stages
              .filter((s) => s.seconds > 0)
              .map((s) => (
                <View key={s.label} style={{ flex: s.seconds, backgroundColor: colors[s.color] }} />
              ))}
          </View>
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: SPACE.stack, rowGap: 4 }}
          >
            {stages.map((s) => (
              <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors[s.color] }}
                />
                <AppText variant="caption" color="muted" numeric>
                  {`${s.label} ${formatDuration(s.seconds)}`}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      )}
      {hasChartData ? (
        <TrendChart
          kind="bar"
          data={toActivityChartData(points, range, today)}
          formatValue={formatDuration}
          title={
            average === null
              ? 'Sleep per night'
              : `Sleep per night, average ${formatDuration(average)}`
          }
          caption={RANGE_CAPTIONS[range]}
          height={96}
          highlightLast
        />
      ) : (
        <AppText variant="body" color="muted">
          No sleep recorded in this range
        </AppText>
      )}
      <StatGroup
        items={[
          { label: 'Average', value: average === null ? NO_VALUE : formatDuration(average) },
          {
            label: 'Bedtime',
            value:
              consistency === null
                ? NO_VALUE
                : `${formatClock(consistency.averageBedtimeMin)} ±${consistency.bedtimeSpreadMin}m`,
          },
          {
            label: 'Wake',
            value: consistency === null ? NO_VALUE : formatClock(consistency.averageWakeMin),
          },
        ]}
      />
      <View style={{ gap: 6 }}>
        {nights
          .slice(-LIST_NIGHTS)
          .reverse()
          .map((night) => (
            <AppText key={night.date} variant="caption" color="muted" numeric>
              {nightLine(night)}
            </AppText>
          ))}
      </View>
    </Card>
  );
}
