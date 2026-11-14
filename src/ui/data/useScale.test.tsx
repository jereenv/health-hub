import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';

import type { ScaleState } from '@/domain/scale/scaleSession';

import { useScale } from './useScale';

// useSyncExternalStore needs getState to return the same object until the state changes.
const IDLE: ScaleState = { kind: 'idle' };

const mockRunner = {
  start: jest.fn(),
  stop: jest.fn(),
  retry: jest.fn(),
  fixAndRetry: jest.fn(() => Promise.resolve()),
  subscribe: jest.fn((_listener: () => void) => () => undefined),
  getState: jest.fn((): ScaleState => IDLE),
};

jest.mock('@/bootstrap/ContainerContext', () => ({ useContainer: () => ({ scale: mockRunner }) }));

type AppStateListener = (state: string) => void;
let appStateListener: AppStateListener = () => undefined;

// The React Native jest preset mocks `currentState` as a function, so the test plants a string.
function setAppState(state: AppStateStatus): void {
  Object.defineProperty(AppState, 'currentState', { value: state, configurable: true });
}

const removeListener = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  setAppState('active');
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListener = listener as AppStateListener;
    return { remove: removeListener };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('starts when the app is active and stops when it goes to the background', async () => {
  await renderHook(() => useScale());
  expect(mockRunner.start).toHaveBeenCalledTimes(1);

  await act(async () => appStateListener('background'));
  expect(mockRunner.stop).toHaveBeenCalledTimes(1);

  await act(async () => appStateListener('active'));
  expect(mockRunner.start).toHaveBeenCalledTimes(2);
});

test('does not start while the app is in the background', async () => {
  setAppState('background');
  await renderHook(() => useScale());
  expect(mockRunner.start).not.toHaveBeenCalled();
});

test('stops on unmount', async () => {
  const { unmount } = await renderHook(() => useScale());
  await unmount();
  expect(mockRunner.stop).toHaveBeenCalledTimes(1);
  expect(removeListener).toHaveBeenCalledTimes(1);
});

test('retry and fix call the runner', async () => {
  const { result } = await renderHook(() => useScale());
  result.current.actions.retry();
  result.current.actions.fix('bluetooth_off');
  expect(mockRunner.retry).toHaveBeenCalledTimes(1);
  expect(mockRunner.fixAndRetry).toHaveBeenCalledWith('bluetooth_off');
});
