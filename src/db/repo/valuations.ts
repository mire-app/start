import { DataError } from '../errors';
import type { SqlDb } from '../sql';
import { newId, now } from './common';

export interface CreateValuationInput {
  accountId: string;
  date: string;
  valueCents: number;
  /** Fund units as a decimal string with a dot. */
  units?: string | null;
  importBatchId?: string | null;
}

export function createValuation(db: SqlDb, input: CreateValuationInput): string {
  return db.transaction(() => {
    const id = newId();
    const ts = now();
    db.run(
      `INSERT INTO valuation (id, account_id, date, value_cents, units, import_batch_id,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.accountId,
        input.date,
        input.valueCents,
        input.units ?? null,
        input.importBatchId ?? null,
        ts,
        ts,
      ],
    );
    return id;
  });
}

/** Soft delete. `deletedByBatchId`: the import that replaced it, so undoing it can restore it. */
export function deleteValuation(
  db: SqlDb,
  id: string,
  options: { deletedByBatchId?: string | null } = {},
): void {
  db.transaction(() => {
    const ts = now();
    const { changes } = db.run(
      `UPDATE valuation SET deleted_at = ?, deleted_by_batch_id = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [ts, options.deletedByBatchId ?? null, ts, id],
    );
    if (changes === 0) throw new DataError('not_found', `valuation ${id} not found`);
  });
}
