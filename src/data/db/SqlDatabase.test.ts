import { createTransactionRunner } from './SqlDatabase';

function recordingExec(failOn?: string): { sql: string[]; exec: (sql: string) => Promise<void> } {
  const sql: string[] = [];
  return {
    sql,
    exec: async (statement) => {
      sql.push(statement);
      if (statement === failOn) {
        throw new Error(`${statement} failed`);
      }
    },
  };
}

test('commits on success and rolls back on throw', async () => {
  const ok = recordingExec();
  await expect(createTransactionRunner(ok.exec)(async () => 7)).resolves.toBe(7);
  expect(ok.sql).toEqual(['BEGIN IMMEDIATE', 'COMMIT']);

  const bad = recordingExec();
  await expect(
    createTransactionRunner(bad.exec)(async () => {
      throw new Error('boom');
    }),
  ).rejects.toThrow('boom');
  expect(bad.sql).toEqual(['BEGIN IMMEDIATE', 'ROLLBACK']);
});

test('rethrows the original error when ROLLBACK also fails', async () => {
  const { exec } = recordingExec('ROLLBACK');
  await expect(
    createTransactionRunner(exec)(async () => {
      throw new Error('boom');
    }),
  ).rejects.toThrow('boom');
});

test('runs transactions one at a time and continues after a failure', async () => {
  const { sql, exec } = recordingExec();
  const run = createTransactionRunner(exec);
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const first = run(async () => {
    await gate;
    throw new Error('first failed');
  });
  const second = run(async () => 'second');
  const firstResult = expect(first).rejects.toThrow('first failed');

  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(sql).toEqual(['BEGIN IMMEDIATE']);

  release();
  await firstResult;
  await expect(second).resolves.toBe('second');
  expect(sql).toEqual(['BEGIN IMMEDIATE', 'ROLLBACK', 'BEGIN IMMEDIATE', 'COMMIT']);
});
