import type { SqlDb } from './sql';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

/** Builds the ordered migration list from `NNNN_name.sql` files (path → SQL text). */
export function loadMigrations(files: Record<string, string>): Migration[] {
  return Object.entries(files)
    .map(([path, sql]) => {
      const match = /(?:^|\/)(\d{4})_([\w-]+)\.sql$/.exec(path);
      if (!match) throw new Error(`Invalid migration file name: ${path}`);
      return { version: Number(match[1]), name: match[2]!, sql };
    })
    .sort((a, b) => a.version - b.version)
    .map((migration, i, all) => {
      if (migration.version === all[i - 1]?.version) {
        throw new Error(`Duplicate migration version: ${migration.version}`);
      }
      return migration;
    });
}

/**
 * Applies the pending migrations in order, each one in its own transaction (SPEC-0004 §2).
 * Stops at the first failure and rethrows it; the versions already applied stay.
 */
export function migrate(db: SqlDb, migrations: readonly Migration[]): void {
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)',
  );
  const current = schemaVersion(db)?.version ?? 0;
  for (const migration of migrations) {
    if (migration.version <= current) continue;
    db.transaction(() => {
      db.exec(migration.sql);
      db.run('INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)', [
        migration.version,
        new Date().toISOString(),
      ]);
    });
  }
}

export interface SchemaVersion {
  version: number;
  appliedAt: string;
}

/** The latest applied migration, or undefined on an empty database. */
export function schemaVersion(db: SqlDb): SchemaVersion | undefined {
  return db.get<SchemaVersion>(
    'SELECT version, applied_at AS appliedAt FROM schema_migrations ORDER BY version DESC LIMIT 1',
  );
}
