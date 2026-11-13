import { createContext, useContext, useEffect, useState } from 'react';
import { View } from 'react-native';

import type { AppContainer } from './container';
import { getAppContainer, resetAppContainer } from './container';
import { EmptyState } from '@/ui/components/EmptyState';
import { Skeleton } from '@/ui/components/Skeleton';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { SPACE } from '@/ui/theme/tokens';

const ContainerContext = createContext<AppContainer | null>(null);

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; container: AppContainer }
  | { status: 'failed'; message: string };

/** Full-screen themed backdrop for the states shown before the container is ready. */
function Backdrop({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        padding: SPACE.screen,
        backgroundColor: colors.bg,
      }}
    >
      {children}
    </View>
  );
}

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
      <Backdrop>
        <View style={{ gap: SPACE.stack }}>
          <Skeleton width="60%" height={40} />
          <Skeleton width="100%" height={120} radius={24} />
          <Skeleton width="100%" height={120} radius={24} />
        </View>
      </Backdrop>
    );
  }
  if (state.status === 'failed') {
    return (
      <Backdrop>
        <EmptyState
          icon="info"
          title="Could not start"
          body={state.message}
          action={{ label: 'Try again', onPress: retry }}
        />
      </Backdrop>
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
