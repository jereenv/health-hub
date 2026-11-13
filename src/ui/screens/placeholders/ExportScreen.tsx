import { TabPlaceholder } from './TabPlaceholder';

export function ExportScreen(): React.JSX.Element {
  return (
    <TabPlaceholder
      title="Export"
      icon="export"
      emptyTitle="Export is on its way"
      body="Soon you can send a summary of your progress to ChatGPT from here."
    />
  );
}
