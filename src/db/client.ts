import type { Method, Params, Result } from './api';
import type { ErrorCode, Request, Response, Row, SqlValue } from './protocol';

export type { Method, Params, Result } from './api';
export type { ErrorCode, Row, SqlValue } from './protocol';

export class DbError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DbError';
  }
}

type RequestBody = Request extends infer R ? (R extends Request ? Omit<R, 'id'> : never) : never;

/** Typed client for the SQLite worker: storage-test queries and API calls. */
export class DbClient {
  private readonly worker = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
  });
  private readonly pending = new Map<
    number,
    { resolve(data: Response & { ok: true }): void; reject(e: Error): void }
  >();
  private nextId = 1;

  constructor() {
    this.worker.onmessage = ({ data }: MessageEvent<Response>) => {
      const call = this.pending.get(data.id);
      if (!call) return;
      this.pending.delete(data.id);
      if (data.ok) call.resolve(data);
      else call.reject(new DbError(data.code, data.message));
    };
  }

  private send(body: RequestBody): Promise<Response & { ok: true }> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ ...body, id } as Request);
    });
  }

  /**
   * Waits until the worker has opened /mire-smoke.sqlite3 and /mire.sqlite3 (and migrated the
   * latter). Rejects with code `busy` if another tab holds them.
   */
  async open(): Promise<void> {
    await this.send({ type: 'open' });
  }

  /** Raw SQL on the storage-test database (SPEC-0002). */
  async exec(sql: string, params: SqlValue[] = []): Promise<Row[]> {
    const data = await this.send({ type: 'exec', sql, params });
    return 'rows' in data ? data.rows : [];
  }

  /** Runs one API method on /mire.sqlite3 in a single transaction (SPEC-0004 §1). */
  async call<M extends Method>(method: M, params: Params<M>): Promise<Result<M>> {
    const data = await this.send({ type: 'call', method, params });
    return ('result' in data ? data.result : undefined) as Result<M>;
  }
}

let shared: DbClient | undefined;

/** The page's single client: opfs-sahpool allows one worker per origin to hold the databases. */
export function dbClient(): DbClient {
  shared ??= new DbClient();
  return shared;
}

export function call<M extends Method>(method: M, params: Params<M>): Promise<Result<M>> {
  return dbClient().call(method, params);
}
