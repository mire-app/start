import { schemaVersion } from './migrate';
import {
  archiveAccount,
  createAccount,
  createGroup,
  setAccountGroup,
  unarchiveAccount,
  updateAccount,
} from './repo/accounts';
import { recordBalanceCheck } from './repo/balance-checks';
import { upsertCategoryMap, upsertSourceLink } from './repo/links';
import {
  createMovement,
  deleteMovement,
  linkTransfer,
  setKind,
  unlinkTransfer,
  updateMovement,
} from './repo/movements';
import { accountBalance, groupValue, netWorth } from './repo/queries';
import { createValuation, deleteValuation } from './repo/valuations';
import type { SqlDb } from './sql';

/**
 * Worker API (SPEC-0004 §1): method → function(db, params). The worker runs each call entirely
 * inside one transaction; there is never a BEGIN/COMMIT spread over several messages.
 */
export const api = {
  schemaVersion: (db: SqlDb) => schemaVersion(db) ?? null,

  createAccount,
  createGroup,
  updateAccount: (db: SqlDb, p: { id: string; patch: Parameters<typeof updateAccount>[2] }) =>
    updateAccount(db, p.id, p.patch),
  archiveAccount: (db: SqlDb, p: { id: string }) => archiveAccount(db, p.id),
  unarchiveAccount: (db: SqlDb, p: { id: string }) => unarchiveAccount(db, p.id),
  setAccountGroup: (db: SqlDb, p: { accountId: string; groupId: string | null }) =>
    setAccountGroup(db, p.accountId, p.groupId),

  createMovement,
  updateMovement: (db: SqlDb, p: { id: string; patch: Parameters<typeof updateMovement>[2] }) =>
    updateMovement(db, p.id, p.patch),
  deleteMovement: (db: SqlDb, p: { id: string }) => deleteMovement(db, p.id),
  setKind: (db: SqlDb, p: { id: string; kind: 'regular' | 'external' }) =>
    setKind(db, p.id, p.kind),
  linkTransfer: (db: SqlDb, p: { movementIdA: string; movementIdB: string }) =>
    linkTransfer(db, p.movementIdA, p.movementIdB),
  unlinkTransfer: (db: SqlDb, p: { groupId: string }) => unlinkTransfer(db, p.groupId),

  createValuation,
  deleteValuation: (db: SqlDb, p: { id: string; deletedByBatchId?: string | null }) =>
    deleteValuation(db, p.id, { deletedByBatchId: p.deletedByBatchId }),

  upsertSourceLink,
  upsertCategoryMap,
  recordBalanceCheck,

  accountBalance: (db: SqlDb, p: { accountId: string; date: string }) =>
    accountBalance(db, p.accountId, p.date),
  netWorth: (db: SqlDb, p: { date: string }) => netWorth(db, p.date),
  groupValue: (db: SqlDb, p: { groupId: string; date: string }) =>
    groupValue(db, p.groupId, p.date),
} satisfies Record<string, (db: SqlDb, params: never) => unknown>;

export type Api = typeof api;
export type Method = keyof Api;
export type Params<M extends Method> =
  Parameters<Api[M]> extends [SqlDb, infer P] ? P : Record<string, never>;
export type Result<M extends Method> = ReturnType<Api[M]>;

/** Runs one call in a single transaction. */
export function runCall(db: SqlDb, method: string, params: unknown): unknown {
  if (!Object.hasOwn(api, method)) throw new Error(`Unknown method: ${method}`);
  const fn = api[method as Method] as (db: SqlDb, params: unknown) => unknown;
  return db.transaction(() => fn(db, params));
}
