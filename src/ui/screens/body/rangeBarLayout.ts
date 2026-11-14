import type { BandStatus, MetricRange } from '@/domain/body/ranges';

export interface RangeBarLayout {
  segments: { label: string; status: BandStatus; fraction: number }[];
  /** The band edges that fall inside the scale, not the scale ends. */
  boundaries: { value: number; fraction: number }[];
  markerFraction: number;
}

function clamp01(fraction: number): number {
  return Math.min(1, Math.max(0, fraction));
}

/**
 * Where each band, band edge and the value sit on the bar, as fractions of the scale. Open-ended
 * bands extend to the scale bounds; bands outside the scale have no width and are left out.
 */
export function rangeBarLayout(range: MetricRange, value: number): RangeBarLayout {
  const { scaleMin, scaleMax } = range;
  const span = scaleMax - scaleMin;
  const fractionOf = (v: number): number => clamp01((v - scaleMin) / span);

  const segments = range.bands
    .map((band) => ({
      label: band.label,
      status: band.status,
      fraction: fractionOf(band.to ?? scaleMax) - fractionOf(band.from ?? scaleMin),
    }))
    .filter((segment) => segment.fraction > 0);

  const boundaries = range.bands.flatMap((band) =>
    band.to !== null && band.to > scaleMin && band.to < scaleMax
      ? [{ value: band.to, fraction: fractionOf(band.to) }]
      : [],
  );

  return { segments, boundaries, markerFraction: fractionOf(value) };
}
