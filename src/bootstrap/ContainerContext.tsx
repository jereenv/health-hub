import { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Button, Text, View } from 'react-native';

import type { AppContainer } from './container';
import { getAppContainer, resetAppContainer } from './container';

const ContainerContext = createContext<AppContainer | null>(null);

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; container: AppContainer }
  | { status: 'failed'; message: string };

/**
 * Provides the app's single container, showing a loading state and, if opening fails, the error
 * with a button to try again.
 */
export function ContainerProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getAppContainer().then(
      (container) => {
        if (!cancelled) setState({ status: 'ready', container });
      },
      (error: unknown) => {
        if (!cancelled) {
          // Build a fresh container on the next attempt rather than reuse a half-opened one.
          resetAppContainer();
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
  }, [attempt]);

  const retry = () => {
    setState({ status: 'loading' });
    setAttempt((current) => current + 1);
  };

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
        <Button title="Try again" onPress={retry} />
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
