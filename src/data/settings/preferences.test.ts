import { openTestDatabase } from '@/test-support/sqljsDatabase';

import { createPreferencesStore, resolveDisplayUnit } from './preferences';
import { createSqliteSettingsRepository } from './SettingsRepository';

async function setup() {
  const settings = createSqliteSettingsRepository(await openTestDatabase());
  return { settings };
}

test('resolveDisplayUnit prefers an explicit unit, then Lyfta, then kg', () => {
  expect(resolveDisplayUnit('lb', 'kg')).toBe('lb');
  expect(resolveDisplayUnit(null, 'lb')).toBe('lb');
  expect(resolveDisplayUnit(null, null)).toBe('kg');
  expect(resolveDisplayUnit('stone', 'lb')).toBe('lb');
  expect(resolveDisplayUnit('LB', null)).toBe('kg');
  expect(resolveDisplayUnit(null, 'lbs')).toBe('kg');
});

test('display unit defaults to the Lyfta account unit, then kg', async () => {
  const { settings } = await setup();
  const empty = await createPreferencesStore(settings);
  expect(empty.getSnapshot()).toEqual({
    displayWeightUnit: 'kg',
    displayUnitIsExplicit: false,
    lyftaAccountUnit: null,
  });

  await settings.set('lyfta.weightUnit', 'lb');
  const detected = await createPreferencesStore(settings);
  expect(detected.getSnapshot()).toEqual({
    displayWeightUnit: 'lb',
    displayUnitIsExplicit: false,
    lyftaAccountUnit: 'lb',
  });
});

test('an invalid stored display unit counts as absent', async () => {
  const { settings } = await setup();
  await settings.set('display.weightUnit', 'stone');
  await settings.set('lyfta.weightUnit', 'lb');
  expect((await createPreferencesStore(settings)).getSnapshot()).toEqual({
    displayWeightUnit: 'lb',
    displayUnitIsExplicit: false,
    lyftaAccountUnit: 'lb',
  });
});

test('an explicit display unit wins, persists and notifies', async () => {
  const { settings } = await setup();
  await settings.set('lyfta.weightUnit', 'lb');
  const store = await createPreferencesStore(settings);
  const listener = jest.fn();
  store.subscribe(listener);

  await store.setDisplayWeightUnit('kg');

  expect(store.getSnapshot()).toEqual({
    displayWeightUnit: 'kg',
    displayUnitIsExplicit: true,
    lyftaAccountUnit: 'lb',
  });
  expect(listener).toHaveBeenCalledTimes(1);
  expect(await settings.get('display.weightUnit')).toBe('kg');
  expect((await createPreferencesStore(settings)).getSnapshot().displayWeightUnit).toBe('kg');
});

test('reload picks up a newly detected Lyfta unit and notifies', async () => {
  const { settings } = await setup();
  const store = await createPreferencesStore(settings);
  const listener = jest.fn();
  store.subscribe(listener);

  await settings.set('lyfta.weightUnit', 'lb');
  await store.reload();

  expect(store.getSnapshot().displayWeightUnit).toBe('lb');
  expect(store.getSnapshot().lyftaAccountUnit).toBe('lb');
  expect(listener).toHaveBeenCalledTimes(1);
});

test('snapshot is referentially stable between changes', async () => {
  const { settings } = await setup();
  const store = await createPreferencesStore(settings);
  const listener = jest.fn();
  store.subscribe(listener);
  const first = store.getSnapshot();

  expect(store.getSnapshot()).toBe(first);
  await store.reload();
  expect(store.getSnapshot()).toBe(first);
  expect(listener).not.toHaveBeenCalled();

  await store.setDisplayWeightUnit('lb');
  const second = store.getSnapshot();
  expect(second).not.toBe(first);
  await store.setDisplayWeightUnit('lb');
  expect(store.getSnapshot()).toBe(second);
});

test('unsubscribing stops notifications', async () => {
  const { settings } = await setup();
  const store = await createPreferencesStore(settings);
  const listener = jest.fn();
  const unsubscribe = store.subscribe(listener);
  unsubscribe();
  await store.setDisplayWeightUnit('lb');
  expect(listener).not.toHaveBeenCalled();
});
