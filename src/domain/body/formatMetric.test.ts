import { ORIGIN_LABEL, TIER_LABEL, formatMetricChange, formatMetricValue } from './formatMetric';

test('masses follow the weight unit, percent and BMI show one decimal, BMR has a thousands separator, whole-number metrics show no decimal', () => {
  expect(formatMetricValue('weight', 80, 'kg')).toEqual({ value: '80.0', unit: 'kg' });
  expect(formatMetricValue('weight', 80, 'lb')).toEqual({ value: '176.4', unit: 'lb' });
  expect(formatMetricValue('lean_mass_kg', 59.93, 'kg')).toEqual({ value: '59.9', unit: 'kg' });
  expect(formatMetricValue('bone_mass_kg', 3.42, 'lb')).toEqual({ value: '7.5', unit: 'lb' });
  expect(formatMetricValue('body_fat_pct', 25.08, 'kg')).toEqual({ value: '25.1', unit: '%' });
  expect(formatMetricValue('bmi', 26.12, 'kg')).toEqual({ value: '26.1', unit: '' });
  expect(formatMetricValue('bmr_kcal', 1811.6, 'kg')).toEqual({ value: '1,812', unit: 'kcal' });
  expect(formatMetricValue('bmr_kcal', 980, 'kg')).toEqual({ value: '980', unit: 'kcal' });
  expect(formatMetricValue('visceral_rating', 8, 'kg')).toEqual({ value: '8', unit: '' });
  expect(formatMetricValue('metabolic_age', 36, 'kg')).toEqual({ value: '36', unit: 'yrs' });
  expect(formatMetricValue('health_score', 74, 'kg')).toEqual({ value: '74', unit: '' });
});

test('changes are signed with a true minus and never show -0', () => {
  expect(formatMetricChange('body_fat_pct', -1.3, 'kg')).toBe('−1.3 pts');
  expect(formatMetricChange('body_fat_pct', 0.8, 'kg')).toBe('+0.8 pts');
  expect(formatMetricChange('weight', -2.4, 'kg')).toBe('−2.4 kg');
  expect(formatMetricChange('weight', -1, 'lb')).toBe('−2.2 lb');
  expect(formatMetricChange('fat_mass_kg', -0.01, 'kg')).toBe('0.0 kg');
  expect(formatMetricChange('body_fat_pct', -0.04, 'kg')).toBe('0.0 pts');
  expect(formatMetricChange('bmr_kcal', -30.4, 'kg')).toBe('−30 kcal');
  expect(formatMetricChange('visceral_rating', -1, 'kg')).toBe('−1');
  expect(formatMetricChange('metabolic_age', 2, 'kg')).toBe('+2 yrs');
  expect(formatMetricChange('bmi', -0.5, 'kg')).toBe('−0.5');
});

test('TIER_LABEL and ORIGIN_LABEL text', () => {
  expect(TIER_LABEL).toEqual({
    measured: 'Measured',
    exact: 'Exact',
    estimated: 'Estimated',
    rough: 'Rough',
  });
  expect(ORIGIN_LABEL).toEqual({
    scale: null,
    formula: null,
    movinglife: 'MovingLife',
    movinglife_derived: 'From MovingLife body fat',
  });
});
