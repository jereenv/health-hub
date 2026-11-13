import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { AppText } from '../components/AppText';
import { useTheme } from '../theme/ThemeProvider';
import {
  axisLabelIndexes,
  barPath,
  describeSeries,
  linePath,
  nearestIndex,
  valueDomain,
  xPositions,
  yScale,
} from './geometry';
import type { PlotBox } from './geometry';

export interface ChartDatum {
  key: string;
  value: number;
  tooltipLabel: string;
  axisLabel: string;
}

const LONG_PRESS_MS = 200;
const FADE_MS = 250;
const DOT_LIMIT = 31;
const BAND_GAP = 6;
const AXIS_WIDTH = 40;
const BUBBLE_WIDTH = 110;
const LABEL_WIDTH = 64;

/** A line or bar chart in SVG with a press-and-hold tooltip and a spoken summary. */
export function TrendChart({
  kind,
  data,
  formatValue,
  title,
  caption,
  height = 160,
  showValueAxis = false,
  highlightLast = false,
}: {
  kind: 'line' | 'bar';
  data: readonly ChartDatum[];
  formatValue: (v: number) => string;
  title: string;
  caption: string;
  height?: number;
  showValueAxis?: boolean;
  highlightLast?: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const opacity = useSharedValue(0);

  const box: PlotBox = {
    width,
    height,
    top: 12,
    bottom: 22,
    left: 0,
    right: showValueAxis ? AXIS_WIDTH : 0,
  };
  const values = useMemo(() => data.map((d) => d.value), [data]);
  const domain = useMemo(
    () => valueDomain(values, { includeZero: kind === 'bar' }),
    [values, kind],
  );
  const xs = xPositions(data.length, box, kind);
  const y = yScale(domain, box);
  const ys = values.map(y);
  const plotBottom = height - box.bottom;
  const selected = data.findIndex((d) => d.key === selectedKey);

  useEffect(() => {
    opacity.set(0);
    opacity.set(withTiming(1, { duration: FADE_MS }));
  }, [data, opacity]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  const select = (touchX: number): void => {
    const i = nearestIndex(xs, touchX);
    if (i >= 0) setSelectedKey(data[i]!.key);
  };
  const gesture = Gesture.Exclusive(
    Gesture.Pan()
      .activateAfterLongPress(LONG_PRESS_MS)
      .runOnJS(true)
      .onStart((e) => select(e.x))
      .onUpdate((e) => select(e.x)),
    Gesture.Tap()
      .runOnJS(true)
      .onEnd(() => setSelectedKey(null)),
  );

  const band = width > 0 && data.length > 0 ? (width - box.right) / data.length - BAND_GAP : 0;
  const bubbleLeft =
    selected >= 0
      ? Math.min(Math.max(xs[selected]! - BUBBLE_WIDTH / 2, 0), width - BUBBLE_WIDTH)
      : 0;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={describeSeries(title, caption, values, formatValue)}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height }}
    >
      {width > 0 ? (
        <GestureDetector gesture={gesture}>
          <Animated.View style={[{ width, height }, fade]}>
            <Svg width={width} height={height}>
              {domain.ticks.map((tick) => (
                <Line
                  key={tick}
                  x1={0}
                  x2={width - box.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke={colors.grid}
                  strokeWidth={1}
                />
              ))}
              {kind === 'bar'
                ? data.map((d, i) => (
                    <Path
                      key={d.key}
                      d={barPath(
                        xs[i]!,
                        Math.max(band, 1),
                        Math.min(ys[i]!, plotBottom),
                        plotBottom,
                      )}
                      fill={highlightLast && i === data.length - 1 ? colors.accent : colors.bar}
                    />
                  ))
                : null}
              {kind === 'line' && data.length > 1 ? (
                <Path
                  d={linePath(xs, ys)}
                  stroke={colors.accentInk}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ) : null}
              {kind === 'line' && data.length <= DOT_LIMIT
                ? data.map((d, i) => (
                    <Circle
                      key={d.key}
                      cx={xs[i]}
                      cy={ys[i]}
                      r={3.5}
                      fill={colors.accentInk}
                      stroke={colors.card}
                      strokeWidth={2}
                    />
                  ))
                : null}
              {selected >= 0 ? (
                <>
                  <Line
                    x1={xs[selected]}
                    x2={xs[selected]}
                    y1={box.top}
                    y2={plotBottom}
                    stroke={colors.muted}
                    strokeWidth={1}
                    strokeDasharray="2 3"
                  />
                  <Circle
                    cx={xs[selected]}
                    cy={ys[selected]}
                    r={6}
                    fill={colors.ink}
                    stroke={colors.card}
                    strokeWidth={2}
                  />
                </>
              ) : null}
            </Svg>
            {showValueAxis
              ? domain.ticks.map((tick) => (
                  <AppText
                    key={tick}
                    variant="micro"
                    color="muted"
                    numeric
                    style={{ position: 'absolute', right: 0, top: y(tick) - 16, width: AXIS_WIDTH }}
                  >
                    {formatValue(tick)}
                  </AppText>
                ))
              : null}
            {axisLabelIndexes(data.length).map((i) => (
              <AppText
                key={data[i]!.key}
                variant="micro"
                color="muted"
                numeric
                style={{
                  position: 'absolute',
                  top: plotBottom + 6,
                  width: LABEL_WIDTH,
                  left: Math.min(Math.max(xs[i]! - LABEL_WIDTH / 2, 0), width - LABEL_WIDTH),
                  textAlign: 'center',
                }}
              >
                {data[i]!.axisLabel}
              </AppText>
            ))}
            {selected >= 0 ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: bubbleLeft,
                  width: BUBBLE_WIDTH,
                  alignItems: 'center',
                  paddingVertical: 4,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.line,
                  backgroundColor: colors.raised,
                }}
              >
                <AppText variant="micro" color="muted">
                  {data[selected]!.tooltipLabel}
                </AppText>
                <AppText variant="micro" numeric style={{ fontWeight: '600' }}>
                  {formatValue(data[selected]!.value)}
                </AppText>
              </View>
            ) : null}
          </Animated.View>
        </GestureDetector>
      ) : null}
    </View>
  );
}
