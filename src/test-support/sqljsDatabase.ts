import initSqlJs from 'sql.js';

import { migrate } from '@/data/db/migrate';
import { MIGRATIONS } from '@/data/db/schema';
import {
  createTransactionRunner,
  type RunResult,
  type SqlDatabase,
  type SqlValue,
} from '@/data/db/SqlDatabase';

/** In-memory database with no schema, for testing the migration runner itself. */
export async function openEmptyTestDatabase(): Promise<SqlDatabase> {
  const SQL = await initSqlJs({
    locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm'),
  });
  const native = new SQL.Database();
  native.run('PRAGMA foreign_keys = ON');

  const exec = async (sql: string): Promise<void> => {
    native.exec(sql);
  };

  const all = async <T>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> => {
    const statement = native.prepare(sql);
    try {
      statement.bind([...params]);
      const rows: T[] = [];
      while (statement.step()) {
        rows.push(statement.getAsObject() as T);
      }
      return rows;
    } finally {
      statement.free();
    }
  };

  return {
    exec,
    async run(sql: string, params: readonly SqlValue[] = []): Promise<RunResult> {
      native.run(sql, [...params]);
      const changes = native.getRowsModified();
      const idRow = native.exec('SELECT last_insert_rowid()');
      return { changes, lastInsertRowId: Number(idRow[0]?.values[0]?.[0] ?? 0) };
    },
    all,
    async first<T>(sql: string, params: readonly SqlValue[] = []): Promise<T | null> {
      const rows = await all<T>(sql, params);
      return rows[0] ?? null;
    },
    transaction: createTransactionRunner(exec),
  };
}

/** In-memory database migrated to the latest schema. */
export async function openTestDatabase(): Promise<SqlDatabase> {
  const db = await openEmptyTestDatabase();
  await migrate(db, MIGRATIONS);
  return db;
}
