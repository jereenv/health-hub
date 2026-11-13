import { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import type { AppContainer } from './container';
import { createAppContainer } from './container';

const ContainerContext = createContext<AppContainer | null>(null);

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; container: AppContainer }
  | { status: 'failed'; message: string };

/** Creates the app container once, showing a loading state and an error if opening fails. */
export function ContainerProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    createAppContainer().then(
      (container) => {
        if (!cancelled) setState({ status: 'ready', container });
      },
      (error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'failed',
            message: error instanceof Error ? error.message : 'Could not open the database',
          });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (state.status === 'failed') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text>Could not start: {state.message}</Text>
      </View>
    );
  }
  return <ContainerContext.Provider value={state.container}>{children}</ContainerContext.Provider>;
}

/** Returns the app container; only valid beneath `ContainerProvider`. */
export function useContainer(): AppContainer {
  const container = useContext(ContainerContext);
  if (container === null) throw new Error('useContainer must be used within ContainerProvider');
  return container;
}
