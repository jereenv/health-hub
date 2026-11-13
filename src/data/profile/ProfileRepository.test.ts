import type { ProfileInput } from '@/domain/profile/profile';
import { openTestDatabase } from '@/test-support/sqljsDatabase';

import { createSqliteProfileRepository } from './ProfileRepository';

const BASE: ProfileInput = {
  heightCm: 175,
  birthDate: '1990-06-15',
  sex: 'female',
  goalWeightKg: 70,
  bmiCutoffs: 'who',
};

async function setup() {
  const db = await openTestDatabase();
  return { db, repo: createSqliteProfileRepository(db) };
}

test('getCurrent and getAt are null before any save', async () => {
  const { repo } = await setup();
  expect(await repo.getCurrent()).toBeNull();
  expect(await repo.getAt('2026-11-01T00:00:00.000Z')).toBeNull();
});

test('save appends versions and getCurrent returns the newest', async () => {
  const { repo, db } = await setup();
  expect(await repo.save(BASE, '2026-01-01T00:00:00.000Z')).toBe(true);
  expect(await repo.save({ ...BASE, heightCm: 176 }, '2026-06-01T00:00:00.000Z')).toBe(true);
  expect(await repo.getCurrent()).toEqual({
    ...BASE,
    heightCm: 176,
    effectiveFrom: '2026-06-01T00:00:00.000Z',
  });
  expect(await db.first('SELECT COUNT(*) AS n FROM profile_version')).toEqual({ n: 2 });
});

test('null fields round-trip', async () => {
  const { repo } = await setup();
  const empty: ProfileInput = {
    heightCm: null,
    birthDate: null,
    sex: null,
    goalWeightKg: null,
    bmiCutoffs: 'who_asian',
  };
  await repo.save(empty, '2026-01-01T00:00:00.000Z');
  expect(await repo.getCurrent()).toEqual({ ...empty, effectiveFrom: '2026-01-01T00:00:00.000Z' });
});

test('getAt returns the version in effect, else the earliest', async () => {
  const { repo } = await setup();
  await repo.save(BASE, '2026-01-01T00:00:00.000Z');
  await repo.save({ ...BASE, heightCm: 176 }, '2026-06-01T00:00:00.000Z');

  expect((await repo.getAt('2026-03-01T00:00:00.000Z'))?.heightCm).toBe(175);
  expect((await repo.getAt('2026-06-01T00:00:00.000Z'))?.heightCm).toBe(176);
  expect((await repo.getAt('2030-01-01T00:00:00.000Z'))?.heightCm).toBe(176);
  expect((await repo.getAt('2020-01-01T00:00:00.000Z'))?.heightCm).toBe(175);
});

test('versions with the same effective time resolve to the highest id', async () => {
  const { repo } = await setup();
  await repo.save(BASE, '2026-01-01T00:00:00.000Z');
  await repo.save({ ...BASE, heightCm: 180 }, '2026-01-01T00:00:00.000Z');
  expect((await repo.getAt('2026-02-01T00:00:00.000Z'))?.heightCm).toBe(180);
  expect((await repo.getAt('2025-01-01T00:00:00.000Z'))?.heightCm).toBe(175);
  expect((await repo.getCurrent())?.heightCm).toBe(180);
});

test('saving an unchanged profile adds no version', async () => {
  const { repo, db } = await setup();
  await repo.save(BASE, '2026-01-01T00:00:00.000Z');
  expect(await repo.save({ ...BASE }, '2026-02-01T00:00:00.000Z')).toBe(false);
  expect(await db.first('SELECT COUNT(*) AS n FROM profile_version')).toEqual({ n: 1 });
  expect((await repo.getCurrent())?.effectiveFrom).toBe('2026-01-01T00:00:00.000Z');
});

test('changing any single field, including to or from null, adds a version', async () => {
  const { repo } = await setup();
  await repo.save(BASE, '2026-01-01T00:00:00.000Z');
  expect(await repo.save({ ...BASE, goalWeightKg: null }, '2026-02-01T00:00:00.000Z')).toBe(true);
  expect(await repo.save({ ...BASE, goalWeightKg: null }, '2026-03-01T00:00:00.000Z')).toBe(false);
  expect(
    await repo.save({ ...BASE, goalWeightKg: null, sex: 'male' }, '2026-04-01T00:00:00.000Z'),
  ).toBe(true);
  expect(
    await repo.save(
      { ...BASE, goalWeightKg: null, sex: 'male', bmiCutoffs: 'who_asian' },
      '2026-05-01T00:00:00.000Z',
    ),
  ).toBe(true);
});

test('concurrent identical saves write one version', async () => {
  const { repo, db } = await setup();
  const results = await Promise.all([
    repo.save(BASE, '2026-01-01T00:00:00.000Z'),
    repo.save(BASE, '2026-01-02T00:00:00.000Z'),
  ]);
  expect(results).toEqual([true, false]);
  expect(await db.first('SELECT COUNT(*) AS n FROM profile_version')).toEqual({ n: 1 });
});
