import type { SqlDb } from '../sql';
import { newId, now } from './common';

/** Points a source account key (e.g. an IBAN in a bank file) at an account. Returns the link id. */
export function upsertSourceLink(
  db: SqlDb,
  input: { source: string; key: string; accountId: string },
): string {
  return db.transaction(() => {
    const existing = db.get<{ id: string }>(
      'SELECT id FROM source_link WHERE source = ? AND key = ? AND deleted_at IS NULL',
      [input.source, input.key],
    );
    const ts = now();
    if (existing) {
      db.run(
        `UPDATE source_link SET account_id = ?, updated_at = ?
         WHERE id = ? AND account_id <> ?`,
        [input.accountId, ts, existing.id, input.accountId],
      );
      return existing.id;
    }
    const id = newId();
    db.run(
      `INSERT INTO source_link (id, source, key, account_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.source, input.key, input.accountId, ts, ts],
    );
    return id;
  });
}

/** Maps a bank's category name to a Míre category. Returns the mapping id. */
export function upsertCategoryMap(
  db: SqlDb,
  input: { source: string; sourceCategory: string; categoryId: string },
): string {
  return db.transaction(() => {
    const existing = db.get<{ id: string }>(
      `SELECT id FROM category_map
       WHERE source = ? AND source_category = ? AND deleted_at IS NULL`,
      [input.source, input.sourceCategory],
    );
    const ts = now();
    if (existing) {
      db.run(
        `UPDATE category_map SET category_id = ?, updated_at = ?
         WHERE id = ? AND category_id <> ?`,
        [input.categoryId, ts, existing.id, input.categoryId],
      );
      return existing.id;
    }
    const id = newId();
    db.run(
      `INSERT INTO category_map (id, source, source_category, category_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.source, input.sourceCategory, input.categoryId, ts, ts],
    );
    return id;
  });
}
