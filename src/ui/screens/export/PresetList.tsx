import { View } from 'react-native';

import type { PresetId } from '@/domain/export/types';
import { AppText } from '@/ui/components/AppText';
import { Card } from '@/ui/components/Card';
import { PressableScale } from '@/ui/components/PressableScale';
import { selectionHaptic } from '@/ui/haptics';
import { useTheme } from '@/ui/theme/ThemeProvider';

const PRESETS: readonly { id: PresetId; title: string }[] = [
  { id: 'week', title: 'Weekly check-in' },
  { id: 'month', title: 'Month review' },
  { id: 'journey', title: 'Whole journey' },
  { id: 'workout', title: 'Single workout' },
  { id: 'custom', title: 'Custom range' },
];

const RADIO = 22;

export function PresetList({
  selected,
  subtitles,
  onSelect,
}: {
  selected: PresetId;
  subtitles: Readonly<Record<PresetId, string>>;
  onSelect: (preset: PresetId) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Card
      accessibilityRole="radiogroup"
      accessibilityLabel="What to export"
      style={{ paddingHorizontal: 16, paddingVertical: 4 }}
    >
      {PRESETS.map((preset, index) => {
        const checked = preset.id === selected;
        return (
          <PressableScale
            key={preset.id}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
            accessibilityLabel={`${preset.title}. ${subtitles[preset.id]}`}
            onPress={() => {
              selectionHaptic();
              onSelect(preset.id);
            }}
            style={{
              minHeight: 62,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: colors.line,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyStrong">{preset.title}</AppText>
              <AppText variant="caption" color="muted">
                {subtitles[preset.id]}
              </AppText>
            </View>
            <View
              style={{
                width: RADIO,
                height: RADIO,
                borderRadius: RADIO / 2,
                borderWidth: checked ? 7 : 1.5,
                borderColor: checked ? colors.accent : colors.muted,
              }}
            />
          </PressableScale>
        );
      })}
    </Card>
  );
}
