import { TabPlaceholder } from './TabPlaceholder';

export function BodyScreen(): React.JSX.Element {
  return (
    <TabPlaceholder
      title="Body"
      icon="body"
      emptyTitle="No weigh-ins yet"
      body="Body metrics arrive when the scale and Health Connect are connected."
    />
  );
}
