import { View } from 'react-native';

import type { HeatCell, HeatLevel } from '@/domain/workouts/history';
import { summarizeHeatStrip } from '@/domain/workouts/history';

import { AppText } from '../components/AppText';
import { useTheme } from '../theme/ThemeProvider';

const CELL_GAP = 3;
const CELL_RADIUS = 3;
const LEVEL_OPACITY: Readonly<Record<Exclude<HeatLevel, 0>, number>> = {
  1: 0.3,
  2: 0.5,
  3: 0.75,
  4: 1,
};
const LEGEND_LEVELS: readonly HeatLevel[] = [0, 1, 2, 3, 4];

/** A training calendar: one column per week (Monday first), one square per day, with a legend. */
export function HeatStrip({ columns }: { columns: readonly HeatCell[][] }): React.JSX.Element {
  const { colors } = useTheme();
  const { trainingDays, pastDays } = summarizeHeatStrip(columns);

  const swatch = (level: HeatLevel): object =>
    level === 0
      ? { backgroundColor: colors.track }
      : { backgroundColor: colors.accentInk, opacity: LEVEL_OPACITY[level] };

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Trained on ${trainingDays} of ${pastDays} days in the last ${columns.length} weeks`}
      style={{ gap: 10 }}
    >
      <View style={{ flexDirection: 'row', gap: CELL_GAP }}>
        {columns.map((column) => (
          <View key={column[0]?.date} style={{ flex: 1, gap: CELL_GAP }}>
            {column.map((cell) => (
              <View
                key={cell.date}
                style={[
                  { aspectRatio: 1, borderRadius: CELL_RADIUS },
                  cell.future ? null : swatch(cell.level),
                ]}
              />
            ))}
          </View>
        ))}
      </View>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}
      >
        <AppText variant="micro" color="muted">
          Less
        </AppText>
        {LEGEND_LEVELS.map((level) => (
          <View
            key={level}
            style={[{ width: 12, height: 12, borderRadius: CELL_RADIUS }, swatch(level)]}
          />
        ))}
        <AppText variant="micro" color="muted">
          More
        </AppText>
      </View>
    </View>
  );
}
