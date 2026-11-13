import type { HeartRateSummary } from '@/domain/activity/heartRate';
import type { RangeKind } from '@/domain/series/buckets';
import type { DateKey } from '@/domain/time/localDate';
import { TrendChart } from '@/ui/charts/TrendChart';
import { AppText } from '@/ui/components/AppText';
import { Card } from '@/ui/components/Card';
import { StatGroup } from '@/ui/components/StatGroup';
import { SPACE } from '@/ui/theme/tokens';

import { RANGE_CAPTIONS, toActivityChartData } from './chartData';

const NO_VALUE = '—';

function bpm(value: number): string {
  return `${Math.round(value)} bpm`;
}

export function HeartRateCard({
  summary,
  range,
  today,
}: {
  summary: HeartRateSummary;
  range: RangeKind;
  today: DateKey;
}): React.JSX.Element {
  const { points, lowest, average, highest } = summary;
  const show = (value: number | null): string => (value === null ? NO_VALUE : bpm(value));
  return (
    <Card style={{ padding: SPACE.card, gap: SPACE.row }}>
      <AppText variant="section" color="muted">
        Heart rate
      </AppText>
      {points.length === 0 ? (
        <AppText variant="body" color="muted">
          No heart rate recorded yet
        </AppText>
      ) : (
        <>
          <StatGroup
            items={[
              { label: 'Lowest', value: show(lowest) },
              { label: 'Average', value: show(average) },
              { label: 'Highest', value: show(highest) },
            ]}
          />
          <TrendChart
            kind="line"
            data={toActivityChartData(points, range, today)}
            formatValue={bpm}
            title={
              average === null
                ? 'Daily average heart rate'
                : `Daily average heart rate, average ${bpm(average)}`
            }
            caption={RANGE_CAPTIONS[range]}
            height={120}
            showValueAxis
          />
          <AppText variant="caption" color="muted">
            Daily average. Lowest and highest are the extremes in this period.
          </AppText>
        </>
      )}
    </Card>
  );
}
