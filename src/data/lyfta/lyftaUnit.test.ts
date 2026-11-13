import type { SettingsRepository } from '@/data/settings/SettingsRepository';

import { LyftaError } from './LyftaError';
import type { LyftaClient } from './LyftaClient';
import { parseWeightUnit, readAccountUnit, refreshLyftaUnit } from './lyftaUnit';

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

function setup(initialUnit: string | null, progress: unknown, error?: Error) {
  const store = new Map<string, string>();
  if (initialUnit !== null) store.set('lyfta.weightUnit', initialUnit);
  const settings: SettingsRepository = {
    get: async (key) => store.get(key) ?? null,
    set: async (key, value) => {
      store.set(key, value);
    },
  };
  const getExerciseProgress = jest.fn(async () => {
    if (error) throw error;
    return progress;
  });
  const client = { getExerciseProgress } as unknown as LyftaClient;
  return { client, settings, store, getExerciseProgress };
}

test('refreshLyftaUnit makes no request when no unit is stored', async () => {
  const { client, settings, getExerciseProgress } = setup(null, { weight_unit: 'lb' });
  expect(await refreshLyftaUnit({ client, settings })).toEqual({ unit: null, changed: false });
  expect(getExerciseProgress).not.toHaveBeenCalled();
});

test('refreshLyftaUnit stores a changed account unit and reports it', async () => {
  const { client, settings, store } = setup('kg', { weight_unit: 'lbs' });
  expect(await refreshLyftaUnit({ client, settings })).toEqual({ unit: 'lb', changed: true });
  expect(store.get('lyfta.weightUnit')).toBe('lb');
});

test('refreshLyftaUnit reports no change when the unit is the same', async () => {
  const { client, settings } = setup('lb', { weight_unit: 'pounds' });
  expect(await refreshLyftaUnit({ client, settings })).toEqual({ unit: 'lb', changed: false });
});

test('refreshLyftaUnit keeps the stored unit when Lyfta reports an unknown one', async () => {
  const { client, settings, store } = setup('kg', { weight_unit: 'stone' });
  expect(await refreshLyftaUnit({ client, settings })).toEqual({ unit: null, changed: false });
  expect(store.get('lyfta.weightUnit')).toBe('kg');
});

test('refreshLyftaUnit propagates unauthorized', async () => {
  const error = new LyftaError('unauthorized', 'Lyfta rejected the API key');
  const { client, settings } = setup('kg', null, error);
  await expect(refreshLyftaUnit({ client, settings })).rejects.toBe(error);
});
