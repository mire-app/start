import { accountValueAt, groupValueAt, netWorthAt } from '../../domain/balance';
import type { AccountData, MovementData, ValuationData } from '../../domain/types';
import { DataError } from '../errors';
import type { SqlDb } from '../sql';

// Load live rows and hand them to the pure domain (SPEC-0004 §6).

const ACCOUNT_SELECT = `SELECT id, type, group_id AS groupId, opening_date AS openingDate,
  opening_balance_cents AS openingBalanceCents FROM account WHERE deleted_at IS NULL`;

function loadMovements(db: SqlDb, date: string, accountIds?: string[]): MovementData[] {
  return db.all<MovementData>(
    `SELECT account_id AS accountId, date, amount_cents AS amountCents, kind FROM movement
     WHERE deleted_at IS NULL AND date <= ?${accountFilter(accountIds)}`,
    [date, ...(accountIds ?? [])],
  );
}

function loadValuations(db: SqlDb, date: string, accountIds?: string[]): ValuationData[] {
  return db.all<ValuationData>(
    `SELECT account_id AS accountId, date, value_cents AS valueCents FROM valuation
     WHERE deleted_at IS NULL AND date <= ?${accountFilter(accountIds)}`,
    [date, ...(accountIds ?? [])],
  );
}

const accountFilter = (ids?: string[]) =>
  ids ? ` AND account_id IN (${ids.map(() => '?').join(', ') || 'NULL'})` : '';

/** Balance (or investment value) of one account at the end of `date`. */
export function accountBalance(db: SqlDb, accountId: string, date: string): number {
  const account = db.get<AccountData>(`${ACCOUNT_SELECT} AND id = ?`, [accountId]);
  if (!account) throw new DataError('not_found', `account ${accountId} not found`);
  const ids = [accountId];
  return accountValueAt(account, loadMovements(db, date, ids), loadValuations(db, date, ids), date);
}

/** Net worth at the end of `date`, archived accounts included. */
export function netWorth(db: SqlDb, date: string): number {
  return netWorthAt(
    db.all<AccountData>(ACCOUNT_SELECT),
    loadMovements(db, date),
    loadValuations(db, date),
    date,
  );
}

/** Value of a group's accounts at the end of `date`, archived accounts included. */
export function groupValue(db: SqlDb, groupId: string, date: string): number {
  const accounts = db.all<AccountData>(`${ACCOUNT_SELECT} AND group_id = ?`, [groupId]);
  const ids = accounts.map((a) => a.id);
  return groupValueAt(
    groupId,
    accounts,
    loadMovements(db, date, ids),
    loadValuations(db, date, ids),
    date,
  );
}
