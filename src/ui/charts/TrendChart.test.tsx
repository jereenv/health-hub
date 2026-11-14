import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../theme/ThemeProvider';
import { TrendChart } from './TrendChart';
import type { ChartDatum } from './TrendChart';

// Reanimated and the gesture handler need native modules; the chart's drawing does not.
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (initial: number) => ({ get: () => initial, set: () => undefined }),
    useAnimatedStyle: () => ({}),
    withTiming: (value: number) => value,
  };
});
jest.mock('react-native-gesture-handler', () => {
  const { View } = jest.requireActual('react-native');
  const gesture = (): Record<string, unknown> => {
    const self: Record<string, unknown> = {};
    for (const name of ['activateAfterLongPress', 'runOnJS', 'onStart', 'onUpdate', 'onEnd']) {
      self[name] = () => self;
    }
    return self;
  };
  return {
    Gesture: { Pan: gesture, Tap: gesture, Exclusive: gesture },
    GestureDetector: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

const DATA: ChartDatum[] = [
  { key: '2026-11-01', value: 80, tooltipLabel: 'Sun 1 Nov', axisLabel: '1 Nov' },
  { key: '2026-11-02', value: 79.4, tooltipLabel: 'Mon 2 Nov', axisLabel: '2 Nov' },
  { key: '2026-11-03', value: 79.9, tooltipLabel: 'Tue 3 Nov', axisLabel: 'Today' },
];

async function renderChart(kind: 'line' | 'bar', extra: { showValueAxis?: boolean } = {}) {
  await render(
    <ThemeProvider>
      <TrendChart
        kind={kind}
        data={DATA}
        formatValue={(v) => `${v.toFixed(1)} kg`}
        title="Weight"
        caption="last 3 days"
        {...extra}
      />
    </ThemeProvider>,
  );
  await fireEvent(screen.getByRole('image'), 'layout', {
    nativeEvent: { layout: { width: 300, height: 160 } },
  });
  return screen.toJSON();
}

// The snapshots were recorded before TrendChart gained optional props: they pin the default render.
test('a default line chart renders as it did before the overlay props', async () => {
  expect(await renderChart('line', { showValueAxis: true })).toMatchSnapshot();
});

test('a default bar chart renders as it did before the overlay props', async () => {
  expect(await renderChart('bar')).toMatchSnapshot();
});
