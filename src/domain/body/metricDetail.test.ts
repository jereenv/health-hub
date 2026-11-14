import type { BodyReading } from '@/data/body/BodyRepository';
import type { WatchBodyFat } from '@/data/healthconnect/HealthConnectRepository';
import type { Profile } from '@/domain/profile/profile';

import { buildMetricDetail, parseMetricId } from './metricDetail';
import { computeReadings } from './readings';
import { METRIC_IDS } from './types';
import type { MetricId } from './types';

const TODAY = '2026-11-13';

// Male, 175 cm, 26 years old on the dates below.
const PROFILE: Profile = {
  heightCm: 175,
  birthDate: '2000-01-01',
  sex: 'male',
  goalWeightKg: null,
  bmiCutoffs: 'who',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
};

function reading(id: number, date: string, weightKg: number, bodyFat: number | null = null) {
  const r: BodyReading = {
    id,
    measuredAt: `${date}T12:00:00.000Z`,
    weightKg,
    impedanceOhm: null,
    source: 'health_connect',
    legacyBodyFatPct: bodyFat,
  };
  return r;
}

function detail(
  metric: MetricId,
  readings: BodyReading[],
  extra: { watch?: WatchBodyFat[]; range?: 'day' | 'week' | 'month' } = {},
) {
  return buildMetricDetail({
    metric,
    readings: computeReadings(readings, [PROFILE]),
    profile: PROFILE,
    watch: extra.watch ?? [],
    range: extra.range ?? 'day',
    today: TODAY,
    unit: 'kg',
  });
}

test('parseMetricId accepts the 13 ids and rejects everything else, arrays and undefined', () => {
  for (const id of METRIC_IDS) expect(parseMetricId(id)).toBe(id);
  expect(parseMetricId('nope')).toBeNull();
  expect(parseMetricId(['body_fat_pct'])).toBeNull();
  expect(parseMetricId(undefined)).toBeNull();
});

test('body fat detail for male 26 carries the Gallagher range, the classified band and the current value', () => {
  const result = detail('body_fat_pct', [reading(1, '2026-11-12', 80, 22)]);
  expect(result.current?.value).toBe(22);
  expect(result.range?.sourceId).toBe('gallagher2000');
  expect(result.classified?.statusLabel).toBe('Slightly high');
});

test('asOfLatest is false when the metric was last measured on an earlier day', () => {
  const result = detail('body_fat_pct', [
    reading(1, '2026-11-10', 80, 20),
    reading(2, '2026-11-12', 79),
  ]);
  expect(result.current?.date).toBe('2026-11-10');
  expect(result.asOfLatest).toBe(false);
  expect(detail('body_fat_pct', [reading(1, '2026-11-12', 80, 20)]).asOfLatest).toBe(true);
});

test('tier follows the current point: a legacy body fat is estimated with origin movinglife', () => {
  const result = detail('body_fat_pct', [reading(1, '2026-11-12', 80, 20)]);
  expect(result.tier).toBe('estimated');
  expect(result.current?.origin).toBe('movinglife');
});

test('watch values appear only for body fat on the Day range and never enter the series stats', () => {
  const watch: WatchBodyFat[] = [
    { hcId: 'a', measuredAt: '2026-11-12T08:00:00.000Z', bodyFatPct: 30, origin: 'watch' },
  ];
  const readings = [reading(1, '2026-11-11', 80, 20), reading(2, '2026-11-12', 80, 22)];
  const day = detail('body_fat_pct', readings, { watch });
  expect(day.watch?.filter((v) => v !== null)).toEqual([30]);
  expect(day.series.stats?.highest).toBe(22);
  expect(detail('body_fat_pct', readings, { watch, range: 'week' }).watch).toBeNull();
  expect(detail('weight', readings, { watch }).watch).toBeNull();
});

test('the tip substitutes {x} with the absolute 30-day change and is null for a healthy value', () => {
  const falling = detail('body_fat_pct', [
    reading(1, '2026-10-20', 80, 23.5),
    reading(2, '2026-11-12', 80, 22.2),
  ]);
  expect(falling.tip).toBe(
    'Down 1.3 points in 30 days, a steady pace. Keep protein high so the loss stays mostly fat.',
  );
  expect(detail('body_fat_pct', [reading(1, '2026-11-12', 80, 15)]).tip).toBeNull();
});

test('weight detail uses the BMI-derived range and unit-converted formatting is left to the screen', () => {
  const result = detail('weight', [reading(1, '2026-11-12', 80)]);
  const healthy = result.range?.bands.find((band) => band.label === 'Healthy');
  expect(healthy?.from).toBeCloseTo(18.5 * 1.75 ** 2);
  expect(result.current?.value).toBe(80);
});

test('a metric with no data gives a null current and an empty series', () => {
  const result = detail('water_pct', [reading(1, '2026-11-12', 80, 20)]);
  expect(result.current).toBeNull();
  expect(result.series.slots.every((slot) => slot.value === null)).toBe(true);
  expect(result.series.stats).toBeNull();
});

test('sources come from the explainer and are empty for MovingLife body fat', () => {
  expect(detail('bmi', [reading(1, '2026-11-12', 80)]).sources.map((s) => s.id)).toEqual([
    'who2004',
  ]);
  expect(detail('body_fat_pct', [reading(1, '2026-11-12', 80, 20)]).sources).toEqual([]);
});
