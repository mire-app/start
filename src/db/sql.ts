import type { Database } from '@sqlite.org/sqlite-wasm';

export type SqlValue = string | number | null;
export type SqlBind = readonly SqlValue[] | Readonly<Record<string, SqlValue>>;

/**
 * Synchronous access to one SQLite database (SPEC-0004 §1): oo1.DB in the worker (opfs-sahpool)
 * and in Node tests (`:memory:`). Repositories in `src/db/repo/` receive it; nothing else runs SQL.
 */
export interface SqlDb {
  exec(sql: string): void;
  all<T = Record<string, SqlValue>>(sql: string, bind?: SqlBind): T[];
  get<T = Record<string, SqlValue>>(sql: string, bind?: SqlBind): T | undefined;
  run(sql: string, bind?: SqlBind): { changes: number };
  /** Runs `fn` atomically. Nested calls become savepoints of the outer transaction. */
  transaction<T>(fn: () => T): T;
}

// oo1 types `bind` as mutable; the values are never modified.
type Bind = Parameters<Database['selectObjects']>[1];

/** Wraps an open oo1 database and turns on foreign keys (SPEC-0004 §3). */
export function wrapDatabase(db: Database): SqlDb {
  db.exec('PRAGMA foreign_keys = ON');
  let depth = 0;
  return {
    exec(sql) {
      db.exec(sql);
    },
    all<T>(sql: string, bind?: SqlBind) {
      return db.selectObjects(sql, bind as Bind) as T[];
    },
    get<T>(sql: string, bind?: SqlBind) {
      return db.selectObject(sql, bind as Bind) as T | undefined;
    },
    run(sql, bind) {
      db.exec({ sql, bind: bind as Bind });
      return { changes: Number(db.changes()) };
    },
    transaction<T>(fn: () => T): T {
      const savepoint = `sp${depth}`;
      db.exec(depth === 0 ? 'BEGIN' : `SAVEPOINT ${savepoint}`);
      depth++;
      try {
        const result = fn();
        depth--;
        db.exec(depth === 0 ? 'COMMIT' : `RELEASE ${savepoint}`);
        return result;
      } catch (err) {
        depth--;
        db.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
        throw err;
      }
    },
  };
}
