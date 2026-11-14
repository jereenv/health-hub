import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { View } from 'react-native';

import { formatShortDate } from '@/domain/format/dates';
import type { DateWindow } from '@/domain/export/types';
import type { DateKey } from '@/domain/time/localDate';
import { AppText } from '@/ui/components/AppText';
import { BottomSheet } from '@/ui/components/BottomSheet';
import { Button } from '@/ui/components/Button';
import { PressableScale } from '@/ui/components/PressableScale';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { SPACE } from '@/ui/theme/tokens';

import { applyPickedDate, localDateKeyFromPicker, pickerDateFromKey } from './exportForm';

type Edge = 'from' | 'to';

export function RangeSheet({
  window,
  bounds,
  onChange,
  onClose,
}: {
  window: DateWindow;
  bounds: { first: DateKey; today: DateKey };
  onChange: (next: DateWindow) => void;
  onClose: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();

  const pick = (edge: Edge): void => {
    DateTimePickerAndroid.open({
      mode: 'date',
      value: pickerDateFromKey(window[edge]),
      minimumDate: pickerDateFromKey(bounds.first > bounds.today ? bounds.today : bounds.first),
      maximumDate: pickerDateFromKey(bounds.today),
      onValueChange: (_event, date) =>
        onChange(applyPickedDate(window, edge, localDateKeyFromPicker(date), bounds)),
    });
  };

  const row = (edge: Edge, label: string): React.JSX.Element => (
    <PressableScale
      accessibilityLabel={`${label}, ${formatShortDate(window[edge])}`}
      onPress={() => pick(edge)}
      style={{
        minHeight: 56,
        paddingHorizontal: 14,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      <AppText variant="body" color="muted">
        {label}
      </AppText>
      <AppText variant="bodyStrong" numeric>
        {formatShortDate(window[edge])}
      </AppText>
    </PressableScale>
  );

  return (
    <BottomSheet open onClose={onClose} title="Custom range">
      <View style={{ gap: SPACE.row }}>
        {row('from', 'From')}
        {row('to', 'To')}
        <Button label="Done" variant="primary" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}
