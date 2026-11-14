import { View } from 'react-native';

import { FORMULA_VERSION } from '@/domain/body/formulas';
import { FORMULA_SOURCES } from '@/domain/body/sources';
import { EPLEY_NOTE } from '@/domain/workouts/metrics';
import { AppText } from '@/ui/components/AppText';
import { BottomSheet } from '@/ui/components/BottomSheet';

export function AboutSheet({ onClose }: { onClose: () => void }): React.JSX.Element {
  return (
    <BottomSheet open onClose={onClose} title="Formula sources">
      <View style={{ gap: 12 }}>
        <AppText variant="body" color="muted">
          {EPLEY_NOTE}
        </AppText>
        <AppText variant="bodyStrong">{`Body formulas · version ${FORMULA_VERSION}`}</AppText>
        <AppText variant="body" color="muted">
          {FORMULA_SOURCES.map((source) => source.short).join(' · ')}
        </AppText>
        <AppText variant="caption" color="muted">
          Health Hub shows estimates for personal tracking. It is not medical advice.
        </AppText>
      </View>
    </BottomSheet>
  );
}
