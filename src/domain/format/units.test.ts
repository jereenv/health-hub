import type { WeightUnit } from '@/domain/workouts/types';
import {
  formatHeight,
  formatVolume,
  formatWeight,
  formatWeightNumber,
  kgToUnit,
  LB_TO_KG,
  unitToKg,
} from './units';

test('unit conversion round-trips', () => {
  expect(kgToUnit(10, 'kg')).toBe(10);
  expect(unitToKg(10, 'kg')).toBe(10);
  expect(unitToKg(kgToUnit(61.2, 'lb'), 'lb')).toBeCloseTo(61.2, 9);
  expect(unitToKg(100, 'lb')).toBeCloseTo(100 * LB_TO_KG, 9);
});

test('formatWeight round-trips whole pounds', () => {
  expect(formatWeight(135 * LB_TO_KG, 'lb')).toBe('135 lb');
  expect(formatWeight(82.5, 'kg')).toBe('82.5 kg');
  expect(formatWeight(135 * LB_TO_KG, 'kg')).toBe('61.2 kg');
});

test('formatWeightNumber keeps at most one decimal and drops .0', () => {
  expect(formatWeightNumber(80, 'kg')).toBe('80');
  expect(formatWeightNumber(80.04, 'kg')).toBe('80');
  expect(formatWeightNumber(0, 'kg')).toBe('0');
});

test.each([
  [850, 'kg', '850 kg'],
  [12400, 'kg', '12.4 t'],
  [1100, 'kg', '1.1 t'],
  [850 * LB_TO_KG, 'lb', '850 lb'],
  [27400 * LB_TO_KG, 'lb', '27.4k lb'],
  [0, 'kg', '0 kg'],
])('formatVolume(%p, %p) = %p', (kg, unit, text) =>
  expect(formatVolume(kg, unit as WeightUnit)).toBe(text),
);

test('formatHeight', () => {
  expect(formatHeight(178)).toBe('178 cm · 5 ft 10 in');
  expect(formatHeight(182.9)).toBe('183 cm · 6 ft 0 in');
});
