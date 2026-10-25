import type { AccountType } from '../../domain/types';
import { DataError } from '../errors';
import type { SqlDb } from '../sql';
import { newId, now } from './common';

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  institution?: string | null;
  groupId?: string | null;
  isin?: string | null;
  openingDate?: string | null;
  openingBalanceCents?: number;
  createdByBatchId?: string | null;
}

export function createAccount(db: SqlDb, input: CreateAccountInput): string {
  return db.transaction(() => {
    const id = newId();
    const ts = now();
    db.run(
      `INSERT INTO account (id, name, type, institution, group_id, isin, opening_date,
         opening_balance_cents, created_by_batch_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.name,
        input.type,
        input.institution ?? null,
        input.groupId ?? null,
        input.isin ?? null,
        input.openingDate ?? null,
        input.openingBalanceCents ?? 0,
        input.createdByBatchId ?? null,
        ts,
        ts,
      ],
    );
    return id;
  });
}

export interface CreateGroupInput {
  name: string;
  createdByBatchId?: string | null;
}

export function createGroup(db: SqlDb, input: CreateGroupInput): string {
  return db.transaction(() => {
    const id = newId();
    const ts = now();
    db.run(
      `INSERT INTO account_group (id, name, created_by_batch_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, input.name, input.createdByBatchId ?? null, ts, ts],
    );
    return id;
  });
}

export interface UpdateAccountInput {
  name?: string;
  type?: AccountType;
  institution?: string | null;
  isin?: string | null;
  openingDate?: string | null;
  openingBalanceCents?: number;
}

const ACCOUNT_COLUMNS: Record<keyof UpdateAccountInput, string> = {
  name: 'name',
  type: 'type',
  institution: 'institution',
  isin: 'isin',
  openingDate: 'opening_date',
  openingBalanceCents: 'opening_balance_cents',
};

export function updateAccount(db: SqlDb, id: string, patch: UpdateAccountInput): void {
  db.transaction(() => {
    const keys = (Object.keys(patch) as (keyof UpdateAccountInput)[]).filter(
      (key) => key in ACCOUNT_COLUMNS && patch[key] !== undefined,
    );
    const sets = keys.map((key) => `${ACCOUNT_COLUMNS[key]} = ?`);
    const values = keys.map((key) => patch[key] ?? null);
    setAccountColumns(db, id, sets, values);
  });
}

export function archiveAccount(db: SqlDb, id: string): void {
  db.transaction(() => setAccountColumns(db, id, ['archived_at = ?'], [now()]));
}

export function unarchiveAccount(db: SqlDb, id: string): void {
  db.transaction(() => setAccountColumns(db, id, ['archived_at = NULL'], []));
}

export function setAccountGroup(db: SqlDb, accountId: string, groupId: string | null): void {
  db.transaction(() => setAccountColumns(db, accountId, ['group_id = ?'], [groupId]));
}

function setAccountColumns(
  db: SqlDb,
  id: string,
  sets: string[],
  values: (string | number | null)[],
): void {
  const { changes } = db.run(
    `UPDATE account SET ${[...sets, 'updated_at = ?'].join(', ')}
     WHERE id = ? AND deleted_at IS NULL`,
    [...values, now(), id],
  );
  if (changes === 0) throw new DataError('not_found', `account ${id} not found`);
}
