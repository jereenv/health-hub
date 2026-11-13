import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/ui/components/AppText';
import { DetailHeader } from '@/ui/components/DetailHeader';
import { SPACE } from '@/ui/theme/tokens';

const SECTIONS: readonly { heading: string; body: string }[] = [
  {
    heading: 'What Health Hub reads',
    body: 'Steps, distance, calories, heart rate, sleep, weight and body fat from Health Connect, including past data when you allow it.',
  },
  {
    heading: 'From which apps',
    body: 'Samsung Health for activity, sleep, heart rate and watch body fat. MovingLife for weigh-ins. Data from other apps is ignored.',
  },
  {
    heading: 'Why',
    body: 'To show your trends and to build the summary you choose to export.',
  },
  {
    heading: 'Where it lives',
    body: 'Only on this phone. Nothing is uploaded, and Health Hub has no analytics.',
  },
  {
    heading: 'What leaves the phone',
    body: 'Only the exports you start yourself, and requests to Lyfta to download your workouts.',
  },
  {
    heading: 'How to revoke access',
    body: 'Open Health Connect settings, then Apps, then Health Hub, and remove its permissions. You can also wipe the imported data in Settings.',
  },
];

export function PrivacyScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <DetailHeader title="Privacy" />
      <ScrollView
        contentContainerStyle={{
          padding: SPACE.screen,
          paddingBottom: insets.bottom + SPACE.screen,
          gap: SPACE.screen,
        }}
      >
        {SECTIONS.map((section) => (
          <View key={section.heading} style={{ gap: 4 }}>
            <AppText variant="bodyStrong">{section.heading}</AppText>
            <AppText variant="body" color="muted">
              {section.body}
            </AppText>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
