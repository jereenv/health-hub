import { useEffect, useState } from 'react';

export type AsyncState<T> =
  { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; message: string };

/** Runs `load` on mount and whenever `deps` change; results from superseded runs are ignored. */
export function useAsyncData<T>(load: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });

  useEffect(() => {
    let current = true;
    load().then(
      (data) => {
        if (current) setState({ status: 'ready', data });
      },
      (error: unknown) => {
        if (current) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Could not load your data',
          });
        }
      },
    );
    return () => {
      current = false;
    };
    // The caller's `deps` decide when to reload; `load` is a fresh closure on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
