import { TabPlaceholder } from './TabPlaceholder';

export function ActivityScreen(): React.JSX.Element {
  return (
    <TabPlaceholder
      title="Activity"
      icon="activity"
      emptyTitle="No activity yet"
      body="Steps, sleep and heart rate arrive when Health Connect is connected."
    />
  );
}
