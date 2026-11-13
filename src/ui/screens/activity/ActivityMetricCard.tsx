import { formatDayMonth } from '@/domain/format/dates';
import type { ActivitySeries } from '@/domain/activity/activitySeries';
import type { RangeKind } from '@/domain/series/buckets';
import type { DateKey } from '@/domain/time/localDate';
import { TrendChart } from '@/ui/charts/TrendChart';
import { AppText } from '@/ui/components/AppText';
import { Card } from '@/ui/components/Card';
import { StatGroup } from '@/ui/components/StatGroup';
import { SPACE } from '@/ui/theme/tokens';

import { RANGE_CAPTIONS, toActivityChartData, withPerDaySuffix } from './chartData';

const NO_VALUE = '—';

/** A titled card with Today / Average / Best stats and a bar chart of one activity metric. */
export function ActivityMetricCard({
  title,
  series,
  range,
  today,
  formatValue,
  emptyText,
  note,
}: {
  title: string;
  series: ActivitySeries;
  range: RangeKind;
  today: DateKey;
  formatValue: (value: number) => string;
  emptyText: string;
  note?: string;
}): React.JSX.Element {
  const hasChartData = series.points.some((point) => point.count > 0);
  const hasData = hasChartData || series.today !== null;
  const { averagePerDay, bestDay } = series;
  const show = (value: number | null): string => (value === null ? NO_VALUE : formatValue(value));
  const chartTitle =
    averagePerDay === null ? title : `${title}, average ${formatValue(averagePerDay)} per day`;

  return (
    <Card style={{ padding: SPACE.card, gap: SPACE.row }}>
      <AppText variant="section" color="muted">
        {title}
      </AppText>
      {!hasData ? null : (
        <StatGroup
          items={[
            { label: 'Today', value: show(series.today) },
            { label: 'Average per day', value: show(averagePerDay) },
            {
              label: bestDay === null ? 'Best day' : `Best day · ${formatDayMonth(bestDay.date)}`,
              value: show(bestDay === null ? null : bestDay.value),
            },
          ]}
        />
      )}
      {hasChartData ? (
        <TrendChart
          kind="bar"
          data={toActivityChartData(series.points, range, today)}
          formatValue={withPerDaySuffix(formatValue, range)}
          title={chartTitle}
          caption={RANGE_CAPTIONS[range]}
          height={96}
          highlightLast
        />
      ) : (
        <AppText variant="body" color="muted">
          {emptyText}
        </AppText>
      )}
      {note === undefined ? null : (
        <AppText variant="caption" color="muted">
          {note}
        </AppText>
      )}
    </Card>
  );
}
