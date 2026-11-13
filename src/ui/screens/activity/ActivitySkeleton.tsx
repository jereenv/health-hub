import { View } from 'react-native';

import { AppText } from '@/ui/components/AppText';
import { Skeleton } from '@/ui/components/Skeleton';
import { SPACE } from '@/ui/theme/tokens';

export function ActivitySkeleton(): React.JSX.Element {
  return (
    <View style={{ padding: SPACE.screen, gap: SPACE.stack }}>
      <Skeleton width="100%" height={48} radius={999} />
      <Skeleton width="100%" height={200} radius={24} />
      <Skeleton width="100%" height={200} radius={24} />
      <Skeleton width="100%" height={200} radius={24} />
      <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
        Importing from Health Connect…
      </AppText>
    </View>
  );
}
