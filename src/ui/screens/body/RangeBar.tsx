import { View } from 'react-native';

import type { MetricRange } from '@/domain/body/ranges';
import { AppText } from '@/ui/components/AppText';
import { useTheme } from '@/ui/theme/ThemeProvider';

import { rangeBarLayout } from './rangeBarLayout';
import { statusColor } from './statusColor';

const BAR_HEIGHT = 8;
const SEGMENT_GAP = 2;
const MARKER_SIZE = 20;
const BOUNDARY_LABEL_WIDTH = 44;

function formatBoundary(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** A segmented bar in the status colours with a marker at the value and the band edges below. */
export function RangeBar({
  range,
  value,
  accessibilityLabel,
  formatLabel = formatBoundary,
}: {
  range: MetricRange;
  value: number;
  accessibilityLabel: string;
  /** Formats the cut-off labels under the bar; defaults to a plain number. */
  formatLabel?: (value: number) => string;
}): React.JSX.Element {
  const { colors } = useTheme();
  const { segments, boundaries, markerFraction } = rangeBarLayout(range, value);
  const lastIndex = segments.length - 1;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <View style={{ height: 30, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', gap: SEGMENT_GAP, height: BAR_HEIGHT }}>
          {segments.map((segment, index) => (
            <View
              key={segment.label}
              style={{
                flex: segment.fraction,
                borderRadius: BAR_HEIGHT / 2,
                backgroundColor: statusColor(colors, segment.status),
                opacity: segment.status === 'high' && index < lastIndex ? 0.6 : 1,
              }}
            />
          ))}
        </View>
        <View
          style={{
            position: 'absolute',
            left: `${markerFraction * 100}%`,
            marginLeft: -MARKER_SIZE / 2,
            width: MARKER_SIZE,
            height: MARKER_SIZE,
            borderRadius: MARKER_SIZE / 2,
            backgroundColor: colors.ink,
            borderWidth: 4,
            borderColor: colors.card,
          }}
        />
      </View>
      <View style={{ height: 16, marginTop: 4 }}>
        {boundaries.map((boundary) => (
          <AppText
            key={boundary.value}
            variant="micro"
            color="muted"
            numeric
            style={{
              position: 'absolute',
              left: `${boundary.fraction * 100}%`,
              marginLeft: -BOUNDARY_LABEL_WIDTH / 2,
              width: BOUNDARY_LABEL_WIDTH,
              textAlign: 'center',
            }}
          >
            {formatLabel(boundary.value)}
          </AppText>
        ))}
      </View>
    </View>
  );
}
