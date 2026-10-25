import { type DbClient, dbClient } from './client';

/**
 * Storage test: a single-row counter persisted in /mire-smoke.sqlite3 (OPFS), which the worker
 * opens next to /mire.sqlite3. SPEC-0016 moves it to Settings › Diagnostics.
 */
export class SmokeStore {
  private static opening: Promise<SmokeStore> | undefined;

  private constructor(private readonly db: DbClient) {}

  /**
   * Opens the store once per page (React StrictMode runs effects twice in development).
   * A failed open (e.g. `busy`) stays cached on purpose: the page must be reloaded to retry.
   * Real multi-tab coordination belongs to SPEC-0006/0008.
   */
  static open(): Promise<SmokeStore> {
    SmokeStore.opening ??= SmokeStore.create();
    return SmokeStore.opening;
  }

  private static async create(): Promise<SmokeStore> {
    const db = dbClient();
    await db.open();
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
