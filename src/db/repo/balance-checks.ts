import type { SqlDb } from '../sql';
import { newId, now } from './common';
import { accountBalance } from './queries';

export interface BalanceCheckInput {
  accountId: string;
  date: string;
  expectedCents: number;
  source?: 'file' | 'user';
  importBatchId?: string | null;
}

export interface BalanceCheckResult {
  id: string;
  computedCents: number;
  /** computed − expected: 0 when Míre agrees with the bank. */
  diff: number;
}

/** Stores the expected balance next to the computed one (SPEC-0004 §5). */
export function recordBalanceCheck(db: SqlDb, input: BalanceCheckInput): BalanceCheckResult {
  return db.transaction(() => {
    const computedCents = accountBalance(db, input.accountId, input.date);
    const id = newId();
    const ts = now();
    db.run(
      `INSERT INTO balance_check (id, account_id, date, expected_cents, computed_cents, source,
         import_batch_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.accountId,
        input.date,
        input.expectedCents,
        computedCents,
        input.source ?? 'user',
        input.importBatchId ?? null,
        ts,
        ts,
      ],
    );
    return { id, computedCents, diff: computedCents - input.expectedCents };
  });
}
