/** Messages between the main thread (client.ts) and the SQLite worker (worker.ts). */

export type SqlValue = string | number | null;
export type Row = Record<string, SqlValue>;

export type Request =
  /** Opens both databases (SPEC-0004 §1); waits for the migrations. */
  | { id: number; type: 'open' }
  /** Raw SQL on the storage-test database (SPEC-0002). */
  | { id: number; type: 'exec'; sql: string; params: SqlValue[] }
  /** One API method on /mire.sqlite3, run as a single transaction (see api.ts). */
  | { id: number; type: 'call'; method: string; params: unknown };

/**
 * `busy`: another tab holds the databases (opfs-sahpool allows a single connection).
 * `migration_failed`: /mire.sqlite3 could not be migrated; every call answers with it.
 * `constraint`: a CHECK, FOREIGN KEY, UNIQUE or NOT NULL constraint failed.
 */
export type ErrorCode =
  | 'busy'
  | 'error'
  | 'migration_failed'
  | 'constraint'
  | 'category_depth'
  | 'valuation_account_type'
  | 'transfer_invalid'
  | 'not_found';

export type Response =
  | { id: number; ok: true; rows: Row[] }
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; code: ErrorCode; message: string };
