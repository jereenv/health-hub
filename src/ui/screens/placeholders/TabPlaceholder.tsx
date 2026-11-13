import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';

import { EmptyState } from '@/ui/components/EmptyState';
import type { IconName } from '@/ui/components/iconPaths';
import { ScreenHeader } from '@/ui/components/ScreenHeader';
import { useTabBarInset } from '@/ui/navigation/TabBar';

/** A tab whose data is not connected yet: a header and one empty state. */
export function TabPlaceholder({
  title,
  subtitle,
  right,
  icon,
  emptyTitle,
  body,
  action,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  icon: IconName;
  emptyTitle: string;
  body: string;
  action?: { label: string; onPress: () => void };
}): React.JSX.Element {
  const inset = useTabBarInset();
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: inset }}>
      <ScreenHeader title={title} subtitle={subtitle} right={right} />
      <EmptyState icon={icon} title={emptyTitle} body={body} action={action} />
    </ScrollView>
  );
}
