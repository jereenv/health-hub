import { parseWeightUnit, readAccountUnit } from './lyftaUnit';

test.each([
  ['lb', 'lb'],
  ['lbs', 'lb'],
  ['LBS', 'lb'],
  ['pound', 'lb'],
  ['pounds', 'lb'],
  ['Pounds', 'lb'],
  ['kg', 'kg'],
  [' kg ', 'kg'],
  ['kgs', 'kg'],
  ['KGS', 'kg'],
  ['kilogram', 'kg'],
  ['kilograms', 'kg'],
  ['Kilograms', 'kg'],
  ['stone', null],
  ['', null],
  [null, null],
  [undefined, null],
  [80, null],
])('parseWeightUnit(%p) = %p', (value, expected) => {
  expect(parseWeightUnit(value)).toBe(expected);
});

test('readAccountUnit reads the top-level weight_unit', () => {
  expect(readAccountUnit({ weight_unit: 'lbs', data: [] })).toBe('lb');
  expect(readAccountUnit({ weight_unit: 'kilograms' })).toBe('kg');
  expect(readAccountUnit({ weight_unit: 'stone' })).toBeNull();
  expect(readAccountUnit({})).toBeNull();
  expect(readAccountUnit(null)).toBeNull();
  expect(readAccountUnit('nonsense')).toBeNull();
});
