import type { ErrorCode, Request, Response, Row, SqlValue } from './protocol';

export type { Row, SqlValue } from './protocol';

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

/** Minimal typed client for the SQLite worker: open a database and run queries. */
export class DbClient {
  private readonly worker = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
  });
  private readonly pending = new Map<
    number,
    { resolve(rows: Row[]): void; reject(e: Error): void }
  >();
  private nextId = 1;

  constructor() {
    this.worker.onmessage = ({ data }: MessageEvent<Response>) => {
      const call = this.pending.get(data.id);
      if (!call) return;
      this.pending.delete(data.id);
      if (data.ok) call.resolve(data.rows);
      else call.reject(new DbError(data.code, data.message));
    };
  }

  private send(body: RequestBody): Promise<Row[]> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ ...body, id } as Request);
    });
  }

  /** Opens (or creates) `filename` in OPFS. Rejects with code `busy` if another tab holds it. */
  async open(filename: string): Promise<void> {
    await this.send({ type: 'open', filename });
  }

  exec(sql: string, params: SqlValue[] = []): Promise<Row[]> {
    return this.send({ type: 'exec', sql, params });
  }
}
