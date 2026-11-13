import { renderHook, waitFor } from '@testing-library/react-native';

import { useHealthConnectStatus } from './useAppData';

const mockContainer = {
  healthConnectGateway: {
    availability: jest.fn(),
    getAccess: jest.fn(),
  },
  syncState: { get: jest.fn() },
};

jest.mock('@/bootstrap/ContainerContext', () => ({ useContainer: () => mockContainer }));
jest.mock('./useSyncSnapshot', () => ({ useSyncSnapshot: () => ({ dataVersion: 0 }) }));

const STATE = { source: 'health_connect', lastSuccessAt: null };

beforeEach(() => {
  mockContainer.healthConnectGateway.availability.mockResolvedValue('available');
  mockContainer.syncState.get.mockResolvedValue(STATE);
});

test('a getAccess rejection becomes an error state, not a permanent loading state', async () => {
  mockContainer.healthConnectGateway.getAccess.mockRejectedValue(new Error('revoked'));
  const { result } = await renderHook(() => useHealthConnectStatus());
  await waitFor(() => expect(result.current.status).toBe('error'));
  expect(result.current).toEqual({ status: 'error', message: 'revoked' });
});

test('changing the version re-reads the status and recovers from the error', async () => {
  mockContainer.healthConnectGateway.getAccess.mockRejectedValueOnce(new Error('revoked'));
  const access = { readAll: true, history: true, missing: [] };
  mockContainer.healthConnectGateway.getAccess.mockResolvedValue(access);
  const { result, rerender } = await renderHook(
    ({ version }: { version: number }) => useHealthConnectStatus(version),
    { initialProps: { version: 0 } },
  );
  await waitFor(() => expect(result.current.status).toBe('error'));
  await rerender({ version: 1 });
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(result.current).toMatchObject({
    status: 'ready',
    data: { connection: { availability: 'available', access } },
  });
});
