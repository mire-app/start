import { DbClient } from './client';

// Skeleton-only database: SPEC-0004 removes it when it creates the real one.
const FILENAME = '/mire-smoke.sqlite3';

/** Storage test: a single-row counter persisted in SQLite (OPFS). */
export class SmokeStore {
  private static opening: Promise<SmokeStore> | undefined;

  private constructor(private readonly db: DbClient) {}

  /** Opens the store once per page (React StrictMode runs effects twice in development). */
  static open(): Promise<SmokeStore> {
    SmokeStore.opening ??= SmokeStore.create();
    return SmokeStore.opening;
  }

  private static async create(): Promise<SmokeStore> {
    const db = new DbClient();
    await db.open(FILENAME);
    await db.exec(
      'CREATE TABLE IF NOT EXISTS smoke(id INTEGER PRIMARY KEY CHECK (id = 1), n INTEGER NOT NULL)',
    );
    await db.exec('INSERT OR IGNORE INTO smoke(id, n) VALUES (1, 0)');
    return new SmokeStore(db);
  }

  async count(): Promise<number> {
    const [row] = await this.db.exec('SELECT n FROM smoke WHERE id = 1');
    return Number(row?.n ?? 0);
  }

  async increment(): Promise<number> {
    const [row] = await this.db.exec('UPDATE smoke SET n = n + 1 WHERE id = 1 RETURNING n');
    return Number(row?.n ?? 0);
  }
}
