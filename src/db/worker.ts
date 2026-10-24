import sqlite3InitModule, { type Database, type Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import type { Request, Response, Row } from './protocol';

// Typed view of the dedicated worker scope (the app's lib is DOM, not WebWorker).
const scope = self as unknown as {
  postMessage(message: Response): void;
  onmessage: ((event: MessageEvent<Request>) => void) | null;
};

const OPEN_RETRY_MS = 1000;
const OPEN_RETRY_STEP_MS = 100;

let sqlite3: Promise<Sqlite3Static> | undefined;
let db: Database | undefined;

class BusyError extends Error {}

/** opfs-sahpool fails with NoModificationAllowedError while another tab holds the access handles. */
function isBusy(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === 'NoModificationAllowedError' || /access handle/i.test(err.message))
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function open(filename: string): Promise<void> {
  if (db) return;
  sqlite3 ??= sqlite3InitModule();
  const s = await sqlite3;
  // Retry for ~1 s: right after a reload the previous page may still hold the handles.
  const deadline = Date.now() + OPEN_RETRY_MS;
  for (;;) {
    try {
      const pool = await s.installOpfsSAHPoolVfs({
        name: 'mire-sahpool',
        forceReinitIfPreviouslyFailed: true,
      } as Parameters<Sqlite3Static['installOpfsSAHPoolVfs']>[0]);
      db = new pool.OpfsSAHPoolDb(filename);
      return;
    } catch (err) {
      if (Date.now() >= deadline) throw isBusy(err) ? new BusyError(String(err)) : err;
      await sleep(OPEN_RETRY_STEP_MS);
    }
  }
}

function exec({ sql, params }: Extract<Request, { type: 'exec' }>): Row[] {
  if (!db) throw new Error('Database is not open');
  return db.exec({
    sql,
    bind: params.length > 0 ? params : undefined,
    returnValue: 'resultRows',
    rowMode: 'object',
  }) as Row[];
}

scope.onmessage = async ({ data: req }) => {
  try {
    const rows = req.type === 'open' ? (await open(req.filename), []) : exec(req);
    scope.postMessage({ id: req.id, ok: true, rows });
  } catch (err) {
    const code = err instanceof BusyError ? 'busy' : 'error';
    scope.postMessage({ id: req.id, ok: false, code, message: String(err) });
  }
};
