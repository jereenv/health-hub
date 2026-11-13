import type { HealthConnectAccess } from '@/data/healthconnect/HealthConnectGateway';

import { requestAccessAndImport } from './requestAccess';

function setup(access: HealthConnectAccess | Error) {
  const resyncHealthConnect = jest.fn().mockResolvedValue(undefined);
  const gateway = {
    requestAccess: jest.fn(() =>
      access instanceof Error ? Promise.reject(access) : Promise.resolve(access),
    ),
  };
  return { gateway, sync: { resyncHealthConnect }, resyncHealthConnect };
}

test('a grant that reports readAll triggers the full Health Connect re-import', async () => {
  const { gateway, sync, resyncHealthConnect } = setup({
    readAll: true,
    history: true,
    missing: [],
  });
  await expect(requestAccessAndImport(gateway, sync)).resolves.toMatchObject({ readAll: true });
  expect(resyncHealthConnect).toHaveBeenCalledTimes(1);
});

test('the re-import also runs when the history permission is still off', async () => {
  const { gateway, sync, resyncHealthConnect } = setup({
    readAll: true,
    history: false,
    missing: [],
  });
  await requestAccessAndImport(gateway, sync);
  expect(resyncHealthConnect).toHaveBeenCalledTimes(1);
});

test('a partial grant imports nothing', async () => {
  const { gateway, sync, resyncHealthConnect } = setup({
    readAll: false,
    history: false,
    missing: ['Steps'],
  });
  await expect(requestAccessAndImport(gateway, sync)).resolves.toMatchObject({ readAll: false });
  expect(resyncHealthConnect).not.toHaveBeenCalled();
});

test('a rejected request propagates and imports nothing', async () => {
  const { gateway, sync, resyncHealthConnect } = setup(new Error('denied'));
  await expect(requestAccessAndImport(gateway, sync)).rejects.toThrow('denied');
  expect(resyncHealthConnect).not.toHaveBeenCalled();
});
