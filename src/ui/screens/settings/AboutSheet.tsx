import { BottomSheet } from '@/ui/components/BottomSheet';
import { AppText } from '@/ui/components/AppText';
import { EPLEY_NOTE } from '@/domain/workouts/metrics';

export function AboutSheet({ onClose }: { onClose: () => void }): React.JSX.Element {
  return (
    <BottomSheet open onClose={onClose} title="Formula sources">
      <AppText variant="body" color="muted">
        {EPLEY_NOTE}
      </AppText>
    </BottomSheet>
  );
}
