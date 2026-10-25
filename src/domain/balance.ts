import type { AccountData, MovementData, ValuationData } from './types';

// Dates are YYYY-MM-DD, so string comparison is chronological.

function sumMovements(
  accountId: string,
  movements: readonly MovementData[],
  after: string | null,
  until: string,
): number {
  let total = 0;
  for (const m of movements) {
    if (m.accountId === accountId && (after === null || m.date > after) && m.date <= until) {
      total += m.amountCents;
    }
  }
  return total;
}

/**
 * Balance of a checking, savings or cash account at the end of `date`: 0 before the opening date,
 * then the opening balance plus every movement (all kinds) up to `date` included.
 */
export function balanceAt(
  account: AccountData,
  movements: readonly MovementData[],
  date: string,
): number {
  if (account.openingDate !== null && date < account.openingDate) return 0;
  return account.openingBalanceCents + sumMovements(account.id, movements, null, date);
}

/**
 * Value of an investment account at `date`: the latest valuation on or before `date` plus the
 * movements strictly after it (same-day movements are part of the valuation). Without a
 * valuation, it is the balance.
 */
export function investmentValueAt(
  account: AccountData,
  valuations: readonly ValuationData[],
  movements: readonly MovementData[],
  date: string,
): number {
  let latest: ValuationData | undefined;
  for (const v of valuations) {
    if (v.accountId === account.id && v.date <= date && (!latest || v.date > latest.date)) {
      latest = v;
    }
  }
  if (!latest) return balanceAt(account, movements, date);
  return latest.valueCents + sumMovements(account.id, movements, latest.date, date);
}

/** Balance or investment value, depending on the account type. */
export function accountValueAt(
  account: AccountData,
  movements: readonly MovementData[],
  valuations: readonly ValuationData[],
  date: string,
): number {
  return account.type === 'investment'
    ? investmentValueAt(account, valuations, movements, date)
    : balanceAt(account, movements, date);
}

/** Sum of every account received (archived ones included). */
export function netWorthAt(
  accounts: readonly AccountData[],
  movements: readonly MovementData[],
  valuations: readonly ValuationData[],
  date: string,
): number {
  let total = 0;
  for (const account of accounts) total += accountValueAt(account, movements, valuations, date);
  return total;
}

/** Net worth restricted to the accounts of one group. */
export function groupValueAt(
  groupId: string,
  accounts: readonly AccountData[],
  movements: readonly MovementData[],
  valuations: readonly ValuationData[],
  date: string,
): number {
  return netWorthAt(
    accounts.filter((a) => a.groupId === groupId),
    movements,
    valuations,
    date,
  );
}

/** Transfers and external contributions are neither income nor expense. */
export function countsAsIncomeOrExpense(movement: Pick<MovementData, 'kind'>): boolean {
  return movement.kind === 'regular';
}
