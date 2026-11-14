import { rangeLabelFormatter } from './rangeLabels';

test('weight cut-offs follow the display unit', () => {
  expect(rangeLabelFormatter('weight', 'kg')?.(61.3)).toBe('61.3');
  expect(rangeLabelFormatter('weight', 'lb')?.(61.3)).toBe('135.1');
  expect(rangeLabelFormatter('fat_mass_kg', 'lb')?.(10)).toBe('22.0');
});

test('non-mass metrics keep the default labels', () => {
  expect(rangeLabelFormatter('body_fat_pct', 'lb')).toBeUndefined();
  expect(rangeLabelFormatter('bmi', 'kg')).toBeUndefined();
});
