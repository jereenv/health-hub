import { View } from 'react-native';

import { AppText } from '@/ui/components/AppText';
import { Skeleton } from '@/ui/components/Skeleton';
import { SPACE } from '@/ui/theme/tokens';

export function BodySkeleton(): React.JSX.Element {
  return (
    <View style={{ padding: SPACE.screen, gap: SPACE.stack }}>
      <Skeleton width="100%" height={132} radius={24} />
      <Skeleton width="100%" height={360} radius={24} />
      <Skeleton width="100%" height={120} radius={24} />
      <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
        Reading your weigh-ins…
      </AppText>
    </View>
  );
}
