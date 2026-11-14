import { View } from 'react-native';

import { SECTION_LABEL } from '@/domain/export/types';
import type { SectionId } from '@/domain/export/types';
import { AppText } from '@/ui/components/AppText';
import { Icon } from '@/ui/components/Icon';
import { PressableScale } from '@/ui/components/PressableScale';
import { selectionHaptic } from '@/ui/haptics';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { TOUCH_MIN } from '@/ui/theme/tokens';

export type ChipId = SectionId | 'csv';

const label = (chip: ChipId): string => (chip === 'csv' ? 'CSV' : SECTION_LABEL[chip]);

export function SectionChips({
  chips,
  isOn,
  onToggle,
}: {
  chips: readonly ChipId[];
  isOn: (chip: ChipId) => boolean;
  onToggle: (chip: ChipId) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {chips.map((chip) => {
        const on = isOn(chip);
        return (
          <PressableScale
            key={chip}
            accessibilityRole="button"
            accessibilityLabel={label(chip)}
            accessibilityState={{ selected: on }}
            onPress={() => {
              selectionHaptic();
              onToggle(chip);
            }}
            style={{
              minHeight: TOUCH_MIN,
              paddingHorizontal: 14,
              borderRadius: 999,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: on ? colors.ink : 'transparent',
              borderWidth: 1,
              borderColor: on ? colors.ink : colors.line,
            }}
          >
            <AppText
              variant="bodyStrong"
              style={{ color: on ? colors.bg : colors.muted, fontSize: 14 }}
            >
              {label(chip)}
            </AppText>
            {on ? <Icon name="check" size={14} color={colors.bg} strokeWidth={2.6} /> : null}
          </PressableScale>
        );
      })}
    </View>
  );
}
