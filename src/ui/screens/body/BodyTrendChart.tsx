import { View } from 'react-native';

import type { MetricSeries } from '@/domain/body/series';
import type { RangeKind } from '@/domain/series/buckets';
import type { DateKey } from '@/domain/time/localDate';
import { TrendChart } from '@/ui/charts/TrendChart';
import { AppText } from '@/ui/components/AppText';
import { useTheme } from '@/ui/theme/ThemeProvider';

import { legendEntries, toBodyChartData } from './chartData';

function LegendItem({
  marker,
  label,
}: {
  marker: React.ReactNode;
  label: string;
}): React.JSX.Element {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {marker}
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
    </View>
  );
}

/**
 * The Body page chart: scale points (solid) and MovingLife points (hollow) with the 7-day average
 * on the Day range, plus the watch checks on the body-fat chart.
 */
export function BodyTrendChart({
  series,
  range,
  today,
  watch,
  formatValue,
  title,
  height = 180,
}: {
  series: MetricSeries;
  range: RangeKind;
  today: DateKey;
  watch?: readonly (number | null)[];
  formatValue: (v: number) => string;
  title: string;
  height?: number;
}): React.JSX.Element {
  const { colors } = useTheme();
  const data = toBodyChartData(series, range, today);
  const average = series.average7 ?? undefined;
  const showWatch = watch !== undefined && watch.some((v) => v !== null);
  const showLegend = series.mixed || showWatch;
  const caption = average
    ? 'The line is the 7-day average; dots are single days.'
    : range === 'week'
      ? 'Weekly averages.'
      : 'Monthly averages.';

  return (
    <View style={{ gap: 10 }}>
      <TrendChart
        kind="line"
        data={data}
        formatValue={formatValue}
        title={title}
        caption={caption}
        height={height}
        showValueAxis
        average={average}
        watch={showWatch ? watch : undefined}
      />
      {showLegend ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {legendEntries(series).map((entry) => (
            <LegendItem
              key={entry.label}
              label={entry.label}
              marker={
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    borderWidth: entry.hollow ? 1.5 : 0,
                    borderColor: colors.muted,
                    backgroundColor: entry.hollow ? 'transparent' : colors.muted,
                  }}
                />
              }
            />
          ))}
          {showWatch ? (
            <LegendItem
              label="Watch check"
              marker={
                <View
                  style={{
                    width: 16,
                    borderTopWidth: 2,
                    borderStyle: 'dotted',
                    borderColor: colors.muted,
                  }}
                />
              }
            />
          ) : null}
        </View>
      ) : null}
      <AppText variant="caption" color="muted">
        {caption}
      </AppText>
    </View>
  );
}
