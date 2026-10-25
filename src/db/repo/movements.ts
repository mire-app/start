import { DataError } from '../errors';
import type { SqlDb } from '../sql';
import { newId, now } from './common';

export interface CreateMovementInput {
  accountId: string;
  date: string;
  valueDate?: string | null;
  amountCents: number;
  description?: string;
  note?: string | null;
  /** Transfers are only made with linkTransfer. */
  kind?: 'regular' | 'external';
  categoryId?: string | null;
  importBatchId?: string | null;
  fingerprint?: string | null;
  sourceCategory?: string | null;
}

export function createMovement(db: SqlDb, input: CreateMovementInput): string {
  return db.transaction(() => {
    const id = newId();
    const ts = now();
    db.run(
      `INSERT INTO movement (id, account_id, date, value_date, amount_cents, description, note,
         kind, category_id, import_batch_id, fingerprint, source_category, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.accountId,
        input.date,
        input.valueDate ?? null,
        input.amountCents,
        input.description ?? '',
        input.note ?? null,
        input.kind ?? 'regular',
        input.categoryId ?? null,
        input.importBatchId ?? null,
        input.fingerprint ?? null,
        input.sourceCategory ?? null,
        ts,
        ts,
      ],
    );
    return id;
  });
}

export interface UpdateMovementInput {
  accountId?: string;
  date?: string;
  valueDate?: string | null;
  amountCents?: number;
  description?: string;
  note?: string | null;
  categoryId?: string | null;
}

const MOVEMENT_COLUMNS: Record<keyof UpdateMovementInput, string> = {
  accountId: 'account_id',
  date: 'date',
  valueDate: 'value_date',
  amountCents: 'amount_cents',
  description: 'description',
  note: 'note',
  categoryId: 'category_id',
};

export function updateMovement(db: SqlDb, id: string, patch: UpdateMovementInput): void {
  db.transaction(() => {
    const keys = (Object.keys(patch) as (keyof UpdateMovementInput)[]).filter(
      (key) => Object.hasOwn(MOVEMENT_COLUMNS, key) && patch[key] !== undefined,
    );
    setMovementColumns(
      db,
      id,
      keys.map((key) => `${MOVEMENT_COLUMNS[key]} = ?`),
      keys.map((key) => patch[key] ?? null),
    );
  });
}

/** Soft delete. */
export function deleteMovement(db: SqlDb, id: string): void {
  db.transaction(() => setMovementColumns(db, id, ['deleted_at = ?'], [now()]));
}

/** Marks an incoming movement as an external contribution, or back as regular. */
export function setKind(db: SqlDb, id: string, kind: 'regular' | 'external'): void {
  db.transaction(() => setMovementColumns(db, id, ['kind = ?'], [kind]));
}

interface TransferCandidate {
  id: string;
  account_id: string;
  amount_cents: number;
  kind: string;
}

/**
 * Pairs two movements as a transfer (SPEC-0004 §4): different accounts, opposite amounts, neither
 * external nor already in a transfer. The only function that sets `transfer_group_id`.
 */
export function linkTransfer(db: SqlDb, movementIdA: string, movementIdB: string): string {
  return db.transaction(() => {
    const load = (id: string) =>
      db.get<TransferCandidate>(
        `SELECT id, account_id, amount_cents, kind FROM movement
         WHERE id = ? AND deleted_at IS NULL`,
        [id],
      );
    const a = load(movementIdA);
    const b = load(movementIdB);
    if (!a || !b) throw new DataError('transfer_invalid', 'movement not found');
    if (a.account_id === b.account_id) {
      throw new DataError('transfer_invalid', 'a transfer needs two different accounts');
    }
    if (a.amount_cents !== -b.amount_cents) {
      throw new DataError('transfer_invalid', 'a transfer needs opposite amounts');
    }
    if (a.kind !== 'regular' || b.kind !== 'regular') {
      throw new DataError('transfer_invalid', 'external or already linked movement');
    }
    const groupId = newId();
    db.run(
      `UPDATE movement SET kind = 'transfer', transfer_group_id = ?, updated_at = ?
       WHERE id IN (?, ?)`,
      [groupId, now(), a.id, b.id],
    );
    return groupId;
  });
}

/** Returns both movements of a transfer to `regular`. */
export function unlinkTransfer(db: SqlDb, groupId: string): void {
  db.transaction(() => {
    db.run(
      `UPDATE movement SET kind = 'regular', transfer_group_id = NULL, updated_at = ?
       WHERE transfer_group_id = ? AND deleted_at IS NULL`,
      [now(), groupId],
    );
  });
}

function setMovementColumns(
  db: SqlDb,
  id: string,
  sets: string[],
  values: (string | number | null)[],
): void {
  const { changes } = db.run(
    `UPDATE movement SET ${[...sets, 'updated_at = ?'].join(', ')}
     WHERE id = ? AND deleted_at IS NULL`,
    [...values, now(), id],
  );
  if (changes === 0) throw new DataError('not_found', `movement ${id} not found`);
}
