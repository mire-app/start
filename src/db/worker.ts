import sqlite3InitModule, { type Database, type Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { runCall } from './api';
import { errorCode } from './errors';
import { migrate } from './migrate';
import { migrations } from './migrations';
import type { Request, Response, Row } from './protocol';
import { type SqlDb, wrapDatabase } from './sql';

// Typed view of the dedicated worker scope (the app's lib is DOM, not WebWorker).
const scope = self as unknown as {
  postMessage(message: Response): void;
  onmessage: ((event: MessageEvent<Request>) => void) | null;
};

const SMOKE_FILENAME = '/mire-smoke.sqlite3';
const DB_FILENAME = '/mire.sqlite3';
// Each database plus its journal takes several pool entries (SPEC-0004 §1).
const POOL_CAPACITY = 10;
const OPEN_RETRY_MS = 1000;
const OPEN_RETRY_STEP_MS = 100;

class BusyError extends Error {}
class MigrationError extends Error {}

/** opfs-sahpool fails with NoModificationAllowedError while another tab holds the access handles. */
function isBusy(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === 'NoModificationAllowedError' || /access handle/i.test(err.message))
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Databases {
  smoke: Database;
  main: SqlDb;
  /** Set when /mire.sqlite3 could not be migrated: every call answers `migration_failed`. */
  migrationError?: string;
}

async function installPool(s: Sqlite3Static) {
  // Retry for ~1 s: right after a reload the previous page may still hold the handles.
  const deadline = Date.now() + OPEN_RETRY_MS;
  for (;;) {
    try {
      // forceReinitIfPreviouslyFailed exists in sqlite-wasm but is missing from its types; without
      // it every retry would get the first cached rejection.
      const pool = await s.installOpfsSAHPoolVfs({
        name: 'mire-sahpool',
        initialCapacity: POOL_CAPACITY,
        forceReinitIfPreviouslyFailed: true,
      } as Parameters<Sqlite3Static['installOpfsSAHPoolVfs']>[0]);
      // initialCapacity only applies to a new pool; grow the one SPEC-0002 created.
      await pool.reserveMinimumCapacity(POOL_CAPACITY);
      return pool;
    } catch (err) {
      if (Date.now() >= deadline) throw isBusy(err) ? new BusyError(String(err)) : err;
      await sleep(OPEN_RETRY_STEP_MS);
    }
  }
}

/** Opens both databases and migrates /mire.sqlite3 before any call is served. */
async function openDatabases(): Promise<Databases> {
  const pool = await installPool(await sqlite3InitModule());
  const smoke = new pool.OpfsSAHPoolDb(SMOKE_FILENAME);
  const main = wrapDatabase(new pool.OpfsSAHPoolDb(DB_FILENAME));
  try {
    migrate(main, migrations);
    return { smoke, main };
  } catch (err) {
    return { smoke, main, migrationError: String(err) };
  }
}

// Started when the worker loads: open and call requests wait for it.
const databases = openDatabases();
// Every request awaits it and reports the failure; this only avoids an unhandled rejection.
databases.catch(() => {});

function exec(smoke: Database, { sql, params }: Extract<Request, { type: 'exec' }>): Row[] {
  return smoke.exec({
    sql,
    bind: params.length > 0 ? params : undefined,
    returnValue: 'resultRows',
    rowMode: 'object',
  }) as Row[];
}

async function handle(req: Request): Promise<Response> {
  const dbs = await databases;
  switch (req.type) {
    case 'open':
      return { id: req.id, ok: true, rows: [] };
    case 'exec':
      return { id: req.id, ok: true, rows: exec(dbs.smoke, req) };
    case 'call':
      if (dbs.migrationError !== undefined) throw new MigrationError(dbs.migrationError);
      return { id: req.id, ok: true, result: runCall(dbs.main, req.method, req.params) };
  }
}

scope.onmessage = async ({ data: req }) => {
  try {
    scope.postMessage(await handle(req));
  } catch (err) {
    const code =
      err instanceof BusyError
        ? 'busy'
        : err instanceof MigrationError
          ? 'migration_failed'
          : errorCode(err);
    scope.postMessage({ id: req.id, ok: false, code, message: String(err) });
  }
};
