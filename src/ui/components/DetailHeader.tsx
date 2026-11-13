import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SPACE, TOUCH_MIN } from '../theme/tokens';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

export function DetailHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        marginTop: insets.top,
        height: TOUCH_MIN,
        paddingHorizontal: SPACE.gap,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <IconButton icon="chevronLeft" accessibilityLabel="Back" onPress={() => router.back()} />
      <AppText
        variant="heading"
        accessibilityRole="header"
        numberOfLines={1}
        style={{ flex: 1, textAlign: 'center' }}
      >
        {title}
      </AppText>
      <View style={{ width: TOUCH_MIN, alignItems: 'center' }}>{right}</View>
    </View>
  );
}
