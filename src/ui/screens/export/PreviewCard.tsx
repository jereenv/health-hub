import { View } from 'react-native';

import { AppText } from '@/ui/components/AppText';
import type { TextColor } from '@/ui/components/AppText';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Card';
import { PressableScale } from '@/ui/components/PressableScale';
import { formatInteger } from '@/domain/format/numbers';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { SPACE } from '@/ui/theme/tokens';

import type { PreviewLine } from './previewLines';

const TONE_COLOR: Record<PreviewLine['tone'], TextColor> = {
  heading: 'accentInk',
  muted: 'muted',
  ink: 'ink',
};

export function PreviewCard({
  lines,
  more,
  sizeText,
  onOpenFull,
  onShareCsv,
}: {
  lines: readonly PreviewLine[];
  more: number;
  sizeText: string;
  onOpenFull: () => void;
  /** Present only when the whole-journey CSV is on. */
  onShareCsv: (() => void) | null;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Card style={{ padding: SPACE.card, gap: 10 }}>
      <View
        style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}
      >
        <AppText variant="bodyStrong">Preview</AppText>
        <AppText variant="caption" color="muted" numeric>
          {sizeText}
        </AppText>
      </View>
      <PressableScale
        accessibilityLabel="Open the full preview"
        onPress={onOpenFull}
        style={{
          padding: 14,
          gap: 3,
          borderRadius: 14,
          backgroundColor: colors.bg,
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        {lines.map((line, index) =>
          line.text === '' ? (
            <View key={index} style={{ height: 8 }} />
          ) : (
            <AppText
              key={index}
              variant="mono"
              numeric
              color={TONE_COLOR[line.tone]}
              numberOfLines={2}
              style={{ fontSize: 12, lineHeight: 18 }}
            >
              {line.text}
            </AppText>
          ),
        )}
        {more > 0 ? (
          <AppText variant="mono" color="muted" style={{ fontSize: 12, lineHeight: 18 }}>
            {`… ${formatInteger(more)} more ${more === 1 ? 'line' : 'lines'}`}
          </AppText>
        ) : null}
      </PressableScale>
      {onShareCsv === null ? null : (
        <View style={{ alignItems: 'flex-start' }}>
          <Button label="Share CSV" variant="plain" onPress={onShareCsv} />
        </View>
      )}
    </Card>
  );
}
