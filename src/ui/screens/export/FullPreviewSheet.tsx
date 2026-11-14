import { ScrollView, useWindowDimensions } from 'react-native';

import { AppText } from '@/ui/components/AppText';
import { BottomSheet } from '@/ui/components/BottomSheet';

/** The whole briefing, scrollable and selectable. */
export function FullPreviewSheet({
  markdown,
  onClose,
}: {
  markdown: string;
  onClose: () => void;
}): React.JSX.Element {
  const { height } = useWindowDimensions();
  return (
    <BottomSheet open onClose={onClose} title="Full preview">
      <ScrollView style={{ maxHeight: height * 0.6 }}>
        <AppText variant="mono" selectable style={{ fontSize: 12, lineHeight: 18 }}>
          {markdown}
        </AppText>
      </ScrollView>
    </BottomSheet>
  );
}
