import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../components/AppText';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/iconPaths';
import { PressableScale } from '../components/PressableScale';
import { selectionHaptic } from '../haptics';
import { useTheme } from '../theme/ThemeProvider';

export const TAB_ITEMS: readonly {
  route: '(today)' | 'body' | 'workouts' | 'activity' | 'export';
  label: string;
  icon: IconName;
}[] = [
  { route: '(today)', label: 'Today', icon: 'home' },
  { route: 'body', label: 'Body', icon: 'body' },
  { route: 'workouts', label: 'Workouts', icon: 'dumbbell' },
  { route: 'activity', label: 'Activity', icon: 'activity' },
  { route: 'export', label: 'Export', icon: 'export' },
];

const BAR_PADDING = 8;
const ITEM_HEIGHT = 52;
const CONTENT_GAP = 24;

/** Bottom padding that keeps screen content clear of the tab bar. */
export function useTabBarInset(): number {
  const { bottom } = useSafeAreaInsets();
  return BAR_PADDING + ITEM_HEIGHT + bottom + BAR_PADDING + CONTENT_GAP;
}

export function TabBar({ state, navigation }: BottomTabBarProps): React.JSX.Element {
  const { colors } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const focusedName = state.routes[state.index]?.name;

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        paddingTop: BAR_PADDING,
        paddingBottom: bottom + BAR_PADDING,
        backgroundColor: colors.nav,
        borderTopWidth: 1,
        borderTopColor: colors.line,
      }}
    >
      {TAB_ITEMS.map((item) => {
        const route = state.routes.find((r) => r.name === item.route);
        if (route === undefined) return null;
        const focused = focusedName === item.route;
        const onPress = (): void => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            selectionHaptic();
            navigation.navigate(route.name, route.params);
          }
        };
        return (
          <PressableScale
            key={item.route}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            style={{
              flex: 1,
              minHeight: ITEM_HEIGHT,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            <View
              style={{
                width: 56,
                height: 30,
                borderRadius: 15,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: focused ? colors.accent : 'transparent',
              }}
            >
              <Icon
                name={item.icon}
                size={20}
                strokeWidth={focused ? 2 : 1.8}
                color={focused ? colors.onAccent : colors.muted}
              />
            </View>
            <AppText
              variant="micro"
              color={focused ? 'ink' : 'muted'}
              style={{ fontWeight: focused ? '600' : '500' }}
            >
              {item.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}
