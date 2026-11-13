import { fireEvent, render, screen } from '@testing-library/react-native';

import { selectionHaptic } from '../haptics';
import { ThemeProvider } from '../theme/ThemeProvider';
import { SegmentedControl } from './SegmentedControl';

// Reanimated needs native worklets, so the press animation is swapped for a plain Pressable.
jest.mock('./PressableScale', () => ({
  PressableScale: jest.requireActual('react-native').Pressable,
}));
jest.mock('../haptics', () => ({ selectionHaptic: jest.fn() }));

const OPTIONS = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
] as const;

async function renderControl(onChange: (value: '7d' | '30d') => void) {
  await render(
    <ThemeProvider>
      <SegmentedControl
        options={OPTIONS}
        value="7d"
        onChange={onChange}
        accessibilityLabel="Range"
      />
    </ThemeProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

test('choosing another option changes the value and fires a haptic', async () => {
  const onChange = jest.fn();
  await renderControl(onChange);
  await fireEvent.press(screen.getByLabelText('30 days'));
  expect(onChange).toHaveBeenCalledWith('30d');
  expect(selectionHaptic).toHaveBeenCalledTimes(1);
});

test('choosing the selected option does nothing', async () => {
  const onChange = jest.fn();
  await renderControl(onChange);
  await fireEvent.press(screen.getByLabelText('7 days'));
  expect(onChange).not.toHaveBeenCalled();
  expect(selectionHaptic).not.toHaveBeenCalled();
});
