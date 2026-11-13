import * as SQLite from 'expo-sqlite';

import { createTransactionRunner, type SqlDatabase, type SqlValue } from './SqlDatabase';

/**
 * Opens the on-device database. WAL keeps reads from blocking a sync write, and
 * foreign keys must be switched on per connection for ON DELETE CASCADE to work.
 */
export async function openExpoSqlDatabase(name: string): Promise<SqlDatabase> {
  const native = await SQLite.openDatabaseAsync(name);
  await native.execAsync('PRAGMA journal_mode = WAL');
  await native.execAsync('PRAGMA foreign_keys = ON');

  const exec = (sql: string): Promise<void> => native.execAsync(sql);

  return {
    exec,
    async run(sql: string, params: readonly SqlValue[] = []) {
      const result = await native.runAsync(sql, [...params]);
      return { changes: result.changes, lastInsertRowId: result.lastInsertRowId };
    },
    all<T>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
      return native.getAllAsync<T>(sql, [...params]);
    },
    first<T>(sql: string, params: readonly SqlValue[] = []): Promise<T | null> {
      return native.getFirstAsync<T>(sql, [...params]);
    },
    transaction: createTransactionRunner(exec),
  };
}
