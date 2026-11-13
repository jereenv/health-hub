/**
 * Minimal async SQL surface the data layer depends on.
 *
 * Repositories talk to this interface instead of `expo-sqlite` so the same code
 * runs on the phone (expo adapter) and in plain-Node Jest (sql.js adapter).
 */
export type SqlValue = string | number | null;

export interface RunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface SqlDatabase {
  /** Runs one or more statements with no parameters and no result. */
  exec(sql: string): Promise<void>;
  /** Runs a single write statement. */
  run(sql: string, params?: readonly SqlValue[]): Promise<RunResult>;
  /** Returns every row of a query. */
  all<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  /** Returns the first row of a query, or null when there is none. */
  first<T>(sql: string, params?: readonly SqlValue[]): Promise<T | null>;
  /** Runs `fn` atomically: commits on success, rolls back if it throws. */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

/**
 * Builds a `transaction` implementation for an adapter that can `exec` SQL.
 *
 * A single connection cannot hold two open transactions, so calls are chained
 * on a promise: each waits for the previous one to settle, which stops two
 * concurrent callers from interleaving their statements.
 */
export function createTransactionRunner(
  exec: (sql: string) => Promise<void>,
): <T>(fn: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();

  return <T>(fn: () => Promise<T>): Promise<T> => {
    const attempt = tail.then(async () => {
      await exec('BEGIN IMMEDIATE');
      try {
        const result = await fn();
        await exec('COMMIT');
        return result;
      } catch (error) {
        await exec('ROLLBACK');
        throw error;
      }
    });
    // A failed transaction must not poison the queue for the next caller.
    tail = attempt.catch(() => undefined);
    return attempt;
  };
}
