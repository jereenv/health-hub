export interface PlotBox {
  width: number;
  height: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** `ticks` are [min, mid, max], ascending. */
export interface ValueDomain {
  min: number;
  max: number;
  ticks: readonly [number, number, number];
}

const LINE_PAD = 0.1;
const BAR_HEADROOM = 1.1;
const FLAT_PAD_FRACTION = 0.05;
const BAR_TOP_RADIUS = 4;
const BAR_BOTTOM_RADIUS = 2;

function domainOf(min: number, max: number): ValueDomain {
  return { min, max, ticks: [min, (min + max) / 2, max] };
}

/** A finite value domain for any input: empty, flat, single-point or all-zero. */
export function valueDomain(
  values: readonly number[],
  opts: { includeZero: boolean },
): ValueDomain {
  if (values.length === 0) return domainOf(0, 1);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (opts.includeZero) return hi > 0 ? domainOf(0, hi * BAR_HEADROOM) : domainOf(0, 1);
  const span = hi - lo;
  const pad = span === 0 ? Math.max(1, Math.abs(hi) * FLAT_PAD_FRACTION) : span * LINE_PAD;
  return domainOf(lo - pad, hi + pad);
}

function plotWidth(box: PlotBox): number {
  return box.width - box.left - box.right;
}

/** Line points span the plot edge to edge; bars sit at the centre of equal bands. */
export function xPositions(count: number, box: PlotBox, kind: 'line' | 'bar'): number[] {
  const w = plotWidth(box);
  if (kind === 'bar')
    return Array.from({ length: count }, (_, i) => box.left + ((i + 0.5) * w) / count);
  if (count === 1) return [box.left + w / 2];
  return Array.from({ length: count }, (_, i) => box.left + (i * w) / (count - 1));
}

export function yScale(domain: ValueDomain, box: PlotBox): (value: number) => number {
  const h = box.height - box.top - box.bottom;
  return (value) => box.top + ((domain.max - value) / (domain.max - domain.min)) * h;
}

export function linePath(xs: readonly number[], ys: readonly number[]): string {
  return xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x} ${ys[i]}`).join('');
}

/** A bar with rounded top (r 4) and bottom (r 2) corners; radii shrink to fit short bars. */
export function barPath(cx: number, bandWidth: number, yTop: number, yBase: number): string {
  const h = Math.max(0, yBase - yTop);
  const rt = Math.min(BAR_TOP_RADIUS, h / 2, bandWidth / 2);
  const rb = Math.min(BAR_BOTTOM_RADIUS, h / 2, bandWidth / 2);
  const x0 = cx - bandWidth / 2;
  const x1 = cx + bandWidth / 2;
  return (
    `M${x0} ${yBase - rb}L${x0} ${yTop + rt}A${rt} ${rt} 0 0 1 ${x0 + rt} ${yTop}` +
    `L${x1 - rt} ${yTop}A${rt} ${rt} 0 0 1 ${x1} ${yTop + rt}L${x1} ${yBase - rb}` +
    `A${rb} ${rb} 0 0 1 ${x1 - rb} ${yBase}L${x0 + rb} ${yBase}A${rb} ${rb} 0 0 1 ${x0} ${yBase - rb}Z`
  );
}

/** Index of the point closest to `touchX`, or -1 when there are no points. */
export function nearestIndex(xs: readonly number[], touchX: number): number {
  let best = -1;
  let bestDistance = Infinity;
  xs.forEach((x, i) => {
    const d = Math.abs(x - touchX);
    if (d < bestDistance) {
      best = i;
      bestDistance = d;
    }
  });
  return best;
}

/** The first, middle and last indexes, without duplicates. */
export function axisLabelIndexes(count: number): number[] {
  if (count === 0) return [];
  return [...new Set([0, Math.floor((count - 1) / 2), count - 1])];
}

export function describeSeries(
  title: string,
  caption: string,
  values: readonly number[],
  formatValue: (v: number) => string,
): string {
  const head = `${title}, ${caption}:`;
  if (values.length === 0) return `${head} no data yet.`;
  const first = formatValue(values[0]!);
  const last = formatValue(values[values.length - 1]!);
  return `${head} from ${first} to ${last}, highest ${formatValue(Math.max(...values))}.`;
}
