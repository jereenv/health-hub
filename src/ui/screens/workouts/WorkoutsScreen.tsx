import { TabPlaceholder } from '../placeholders/TabPlaceholder';

/** Placeholder until the Workouts overview task fills it in. */
export function WorkoutsScreen(): React.JSX.Element {
  return (
    <TabPlaceholder
      title="Workouts"
      icon="dumbbell"
      emptyTitle="Workouts are coming"
      body="Your Lyfta history will appear here."
    />
  );
}
