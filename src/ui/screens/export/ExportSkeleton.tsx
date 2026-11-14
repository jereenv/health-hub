import { View } from 'react-native';

import { AppText } from '@/ui/components/AppText';
import { Skeleton } from '@/ui/components/Skeleton';
import { SPACE } from '@/ui/theme/tokens';

export function ExportSkeleton(): React.JSX.Element {
  return (
    <View style={{ padding: SPACE.screen, gap: SPACE.stack }}>
      <Skeleton width="100%" height={330} radius={24} />
      <Skeleton width="100%" height={44} radius={999} />
      <Skeleton width="100%" height={52} radius={16} />
      <Skeleton width="100%" height={260} radius={24} />
      <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
        Reading your data…
      </AppText>
    </View>
  );
}
