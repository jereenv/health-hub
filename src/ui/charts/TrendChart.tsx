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
  lineRuns,
  nearestIndex,
  valueDomain,
  xPositions,
  yScale,
} from './geometry';
import type { PlotBox } from './geometry';

export interface ChartDatum {
  key: string;
  /** Null is an empty slot: it keeps its place on the axis but has no dot, bar or tooltip. */
  value: number | null;
  tooltipLabel: string;
  axisLabel: string;
  /** Drawn as a ring instead of a filled dot (a different measuring method). */
  hollow?: boolean;
  /** The line starts a new segment here instead of joining the previous point. */
  breakBefore?: boolean;
}

const LONG_PRESS_MS = 200;
const FADE_MS = 250;
const DOT_LIMIT = 31;
const BAND_GAP = 6;
const AXIS_WIDTH = 40;
const BUBBLE_WIDTH = 110;
const LABEL_WIDTH = 64;
const AVERAGE_DOT_RADIUS = 2.5;
const WATCH_DOT_RADIUS = 3.5;

function present(values: readonly (number | null)[]): number[] {
  return values.filter((v): v is number => v !== null);
}

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
  average,
  watch,
}: {
  kind: 'line' | 'bar';
  data: readonly ChartDatum[];
  formatValue: (v: number) => string;
  title: string;
  caption: string;
  height?: number;
  showValueAxis?: boolean;
  highlightLast?: boolean;
  /**
   * Aligned to `data`. When given, the accent line draws it and the daily points become small
   * muted dots.
   */
  average?: readonly (number | null)[];
  /** Aligned to `data`. Drawn as a separate dotted line with ring markers, bridging gaps. */
  watch?: readonly (number | null)[];
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
    () =>
      valueDomain(present([...values, ...(average ?? []), ...(watch ?? [])]), {
        includeZero: kind === 'bar',
      }),
    [values, average, watch, kind],
  );
  const xs = xPositions(data.length, box, kind);
  const y = yScale(domain, box);
  const ys = values.map((v) => (v === null ? null : y(v)));
  const lineValues = average ?? values;
  const runs = useMemo(
    () =>
      lineRuns(
        lineValues,
        data.map((d) => d.breakBefore === true),
      ),
    [lineValues, data],
  );
  const watchRun = useMemo(() => (watch ? lineRuns(watch, [])[0] : undefined), [watch]);
  const plotBottom = height - box.bottom;
  const selected = data.findIndex((d) => d.key === selectedKey && d.value !== null);

  useEffect(() => {
    opacity.set(0);
    opacity.set(withTiming(1, { duration: FADE_MS }));
  }, [data, opacity]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  const select = (touchX: number): void => {
    const filled = data.flatMap((d, index) => (d.value === null ? [] : [index]));
    const nearest = nearestIndex(
      filled.map((index) => xs[index]!),
      touchX,
    );
    if (nearest >= 0) setSelectedKey(data[filled[nearest]!]!.key);
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
                ? data.map((d, i) =>
                    ys[i] === null ? null : (
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
                    ),
                  )
                : null}
              {kind === 'line'
                ? runs
                    .filter((run) => run.length > 1)
                    .map((run) => (
                      <Path
                        key={`line-${run[0]}`}
                        d={linePath(
                          run.map((i) => xs[i]!),
                          run.map((i) => y(lineValues[i]!)),
                        )}
                        stroke={colors.accentInk}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    ))
                : null}
              {kind === 'line' && watchRun !== undefined && watchRun.length > 1 ? (
                <Path
                  d={linePath(
                    watchRun.map((i) => xs[i]!),
                    watchRun.map((i) => y(watch![i]!)),
                  )}
                  stroke={colors.muted}
                  strokeWidth={2}
                  strokeDasharray="2 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ) : null}
              {kind === 'line' && data.length <= DOT_LIMIT
                ? data.map((d, i) =>
                    ys[i] === null ? null : average ? (
                      <Circle
                        key={d.key}
                        cx={xs[i]}
                        cy={ys[i]!}
                        r={AVERAGE_DOT_RADIUS}
                        fill={d.hollow ? colors.card : colors.muted}
                        stroke={colors.muted}
                        strokeWidth={d.hollow ? 1.5 : 0}
                      />
                    ) : (
                      <Circle
                        key={d.key}
                        cx={xs[i]}
                        cy={ys[i]!}
                        r={3.5}
                        fill={d.hollow ? colors.card : colors.accentInk}
                        stroke={d.hollow ? colors.accentInk : colors.card}
                        strokeWidth={2}
                      />
                    ),
                  )
                : null}
              {kind === 'line' && watch
                ? watch.map((v, i) =>
                    v === null ? null : (
                      <Circle
                        key={`watch-${data[i]!.key}`}
                        cx={xs[i]}
                        cy={y(v)}
                        r={WATCH_DOT_RADIUS}
                        fill={colors.card}
                        stroke={colors.muted}
                        strokeWidth={2}
                      />
                    ),
                  )
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
                    cy={ys[selected] ?? 0}
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
                  {formatValue(data[selected]!.value!)}
                </AppText>
              </View>
            ) : null}
          </Animated.View>
        </GestureDetector>
      ) : null}
    </View>
  );
}
