/** Messages between the main thread (client.ts) and the SQLite worker (worker.ts). */

export type SqlValue = string | number | null;
export type Row = Record<string, SqlValue>;

export type Request =
  | { id: number; type: 'open'; filename: string }
  | { id: number; type: 'exec'; sql: string; params: SqlValue[] };

/** `busy`: another tab holds the database (opfs-sahpool allows a single connection). */
export type ErrorCode = 'busy' | 'error';

export type Response =
  | { id: number; ok: true; rows: Row[] }
  | { id: number; ok: false; code: ErrorCode; message: string };
