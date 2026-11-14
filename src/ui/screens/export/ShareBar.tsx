import { View } from 'react-native';

import { AppText } from '@/ui/components/AppText';
import { Icon } from '@/ui/components/Icon';
import { PressableScale } from '@/ui/components/PressableScale';
import { useTheme } from '@/ui/theme/ThemeProvider';

export interface ShareNotice {
  text: string;
  tone: 'ok' | 'error';
}

const BUTTON = 56;

/** The sticky Share and Copy buttons, with the one-line result above them. */
export function ShareBar({
  bottom,
  enabled,
  notice,
  onShare,
  onCopy,
}: {
  bottom: number;
  enabled: boolean;
  notice: ShareNotice | null;
  onShare: () => void;
  onCopy: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={{ position: 'absolute', left: 20, right: 20, bottom, gap: 8 }}>
      {notice === null ? null : (
        <AppText
          variant="caption"
          color={notice.tone === 'error' ? 'statusHigh' : 'muted'}
          accessibilityLiveRegion="polite"
          style={{ textAlign: 'center' }}
        >
          {notice.text}
        </AppText>
      )}
      <View style={{ flexDirection: 'row', gap: 10, opacity: enabled ? 1 : 0.4 }}>
        <PressableScale
          accessibilityLabel="Share to ChatGPT"
          accessibilityState={{ disabled: !enabled }}
          disabled={!enabled}
          onPress={onShare}
          style={{
            flex: 1,
            height: BUTTON,
            borderRadius: 999,
            backgroundColor: colors.accent,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Icon name="export" size={18} color={colors.onAccent} strokeWidth={2.2} />
          <AppText variant="bodyStrong" color="onAccent" style={{ fontSize: 16 }}>
            Share to ChatGPT
          </AppText>
        </PressableScale>
        <PressableScale
          accessibilityLabel="Copy to clipboard"
          accessibilityState={{ disabled: !enabled }}
          disabled={!enabled}
          onPress={onCopy}
          style={{
            width: BUTTON,
            height: BUTTON,
            borderRadius: BUTTON / 2,
            backgroundColor: colors.raised,
            borderWidth: 1,
            borderColor: colors.line,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="clipboard" size={20} color={colors.ink} />
        </PressableScale>
      </View>
    </View>
  );
}
