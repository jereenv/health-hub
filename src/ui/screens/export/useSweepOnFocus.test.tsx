import { renderHook } from '@testing-library/react-native';
import { useEffect as mockUseEffect } from 'react';

import { useSweepOnFocus } from './useSweepOnFocus';

let mockFocus: (() => void) | null = null;

jest.mock('expo-router', () => ({
  // Runs the callback when it changes, and keeps it so the test can fire later focus events.
  useFocusEffect: (callback: () => void) => {
    mockUseEffect(() => {
      mockFocus = callback;
      callback();
    }, [callback]);
  },
}));

beforeEach(() => {
  mockFocus = null;
});

test('sweeps on mount and again each time the tab gains focus', async () => {
  const sweep = jest.fn(() => Promise.resolve());
  await renderHook(() => useSweepOnFocus(sweep, () => false));
  expect(sweep).toHaveBeenCalledTimes(1);
  mockFocus!();
  mockFocus!();
  expect(sweep).toHaveBeenCalledTimes(3);
});

test('never sweeps while a share is in progress', async () => {
  const sweep = jest.fn(() => Promise.resolve());
  const busy = { current: true };
  await renderHook(() => useSweepOnFocus(sweep, () => busy.current));
  mockFocus!();
  expect(sweep).not.toHaveBeenCalled();
  busy.current = false;
  mockFocus!();
  expect(sweep).toHaveBeenCalledTimes(1);
});

test('a failing sweep is swallowed', async () => {
  const sweep = jest.fn(() => Promise.reject(new Error('disk')));
  await renderHook(() => useSweepOnFocus(sweep, () => false));
  await Promise.resolve();
  expect(sweep).toHaveBeenCalled();
});
