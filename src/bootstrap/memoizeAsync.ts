/**
 * Runs `factory` once and hands every caller the same promise, so a slow async setup (opening the
 * database) is never started twice, e.g. by a remount or Fast Refresh. A rejection is not kept:
 * the next `get()` tries again. `reset()` forgets the current result.
 */
export function memoizeAsync<T>(factory: () => Promise<T>): { get(): Promise<T>; reset(): void } {
  let pending: Promise<T> | null = null;

  return {
    get() {
      if (pending === null) {
        // `async` turns a synchronous throw in `factory` into a rejection as well.
        const attempt = (async () => factory())();
        pending = attempt;
        attempt.catch(() => {
          if (pending === attempt) pending = null;
        });
      }
      return pending;
    },
    reset() {
      pending = null;
    },
  };
}
