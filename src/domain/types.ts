/** Data the domain works on (SPEC-0004 §6). Callers pass live rows only (not soft-deleted). */

export type AccountType = 'checking' | 'savings' | 'cash' | 'investment';
export type MovementKind = 'regular' | 'transfer' | 'external';

export interface AccountData {
  id: string;
  type: AccountType;
  groupId: string | null;
  /** YYYY-MM-DD; null means the account counts "since always". */
  openingDate: string | null;
  openingBalanceCents: number;
}

export interface MovementData {
  accountId: string;
  date: string;
  amountCents: number;
  kind: MovementKind;
}

export interface ValuationData {
  accountId: string;
  date: string;
  valueCents: number;
}
