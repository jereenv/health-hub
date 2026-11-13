import { View } from 'react-native';

import { selectionHaptic } from '../haptics';
import { useTheme } from '../theme/ThemeProvider';
import { RADIUS } from '../theme/tokens';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        gap: 4,
        padding: 4,
        borderRadius: RADIUS.pill,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressableScale
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              selectionHaptic();
              onChange(option.value);
            }}
            style={{
              flex: 1,
              height: 40,
              borderRadius: RADIUS.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? colors.accent : 'transparent',
            }}
          >
            <AppText
              variant="bodyStrong"
              color={selected ? 'onAccent' : 'muted'}
              style={{ fontSize: 14 }}
            >
              {option.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}
