import { fireEvent, render, screen } from '@testing-library/react-native';
import { useColorScheme } from 'react-native';

import type { ScaleState } from '@/domain/scale/scaleSession';
import { ThemeProvider } from '@/ui/theme/ThemeProvider';

import { ScaleCard } from './ScaleCard';

// Reanimated needs native worklets, so the press animation is swapped for a plain Pressable.
jest.mock('@/ui/components/PressableScale', () => ({
  PressableScale: jest.requireActual('react-native').Pressable,
}));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  default: jest.fn(),
  __esModule: true,
}));

const STATES: ScaleState[] = [
  { kind: 'idle' },
  { kind: 'searching' },
  { kind: 'connecting' },
  { kind: 'waiting' },
  { kind: 'live', weightKg: 80.5, stable: false },
  { kind: 'live', weightKg: 80.5, stable: true },
  { kind: 'saved', weightKg: 80.5 },
  { kind: 'off', reason: 'permission_needed' },
  { kind: 'off', reason: 'permission_blocked' },
  { kind: 'off', reason: 'bluetooth_off' },
  { kind: 'off', reason: 'unsupported' },
  { kind: 'error', error: 'not_found' },
  { kind: 'error', error: 'connect_failed' },
  { kind: 'error', error: 'connection_lost' },
  { kind: 'error', error: 'save_failed' },
];

function makeHandlers() {
  return { retry: jest.fn(), fix: jest.fn(), openBody: jest.fn() };
}

describe.each(['dark', 'light'] as const)('in the %s scheme', (scheme) => {
  beforeEach(() => {
    jest.mocked(useColorScheme).mockReturnValue(scheme);
  });

  test.each(STATES)('renders every state in both schemes without throwing: %j', async (state) => {
    await render(
      <ThemeProvider>
        <ScaleCard state={state} unit="kg" handlers={makeHandlers()} />
      </ThemeProvider>,
    );
    expect(screen.toJSON() === null).toBe(state.kind === 'idle');
  });
});

test('the buttons call the matching handler', async () => {
  const handlers = makeHandlers();
  const wrap = (state: ScaleState) => (
    <ThemeProvider>
      <ScaleCard state={state} unit="kg" handlers={handlers} />
    </ThemeProvider>
  );
  const view = await render(wrap({ kind: 'off', reason: 'bluetooth_off' }));
  await fireEvent.press(screen.getByLabelText('Turn on Bluetooth'));
  expect(handlers.fix).toHaveBeenCalledWith('bluetooth_off');

  await view.rerender(wrap({ kind: 'error', error: 'not_found' }));
  await fireEvent.press(screen.getByLabelText('Try again'));
  expect(handlers.retry).toHaveBeenCalledTimes(1);

  await view.rerender(wrap({ kind: 'saved', weightKg: 80.5 }));
  await fireEvent.press(screen.getByLabelText('See in Body'));
  expect(handlers.openBody).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByLabelText('Weigh again'));
  expect(handlers.retry).toHaveBeenCalledTimes(2);
});
