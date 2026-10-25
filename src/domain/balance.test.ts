import { describe, expect, it } from 'vitest';
import {
  balanceAt,
  countsAsIncomeOrExpense,
  groupValueAt,
  investmentValueAt,
  netWorthAt,
} from './balance';
import type { AccountData, MovementData, ValuationData } from './types';

const checking: AccountData = {
  id: 'checking',
  type: 'checking',
  groupId: null,
  openingDate: '2026-09-01',
  openingBalanceCents: 10000,
};
const checkingMovements: MovementData[] = [
  { accountId: 'checking', date: '2026-09-05', amountCents: 5000, kind: 'regular' },
  { accountId: 'checking', date: '2026-09-10', amountCents: -2000, kind: 'regular' },
];

describe('CA-05 · balanceAt', () => {
  it.each([
    ['2026-08-31', 0],
    ['2026-09-01', 10000],
    ['2026-09-05', 15000],
    ['2026-09-30', 13000],
  ])('at %s is %i', (date, expected) => {
    expect(balanceAt(checking, checkingMovements, date)).toBe(expected);
  });

  it('without an opening date counts since always', () => {
    const always = { ...checking, openingDate: null, openingBalanceCents: 0 };
    expect(balanceAt(always, checkingMovements, '2026-09-30')).toBe(3000);
    expect(balanceAt(always, checkingMovements, '2026-09-05')).toBe(5000);
  });

  it('adds every kind and ignores other accounts', () => {
    const movements: MovementData[] = [
      ...checkingMovements,
      { accountId: 'checking', date: '2026-09-11', amountCents: -300, kind: 'transfer' },
      { accountId: 'checking', date: '2026-09-12', amountCents: 700, kind: 'external' },
      { accountId: 'other', date: '2026-09-12', amountCents: 999, kind: 'regular' },
    ];
    expect(balanceAt(checking, movements, '2026-09-30')).toBe(13400);
  });
});

describe('CA-06 · investmentValueAt', () => {
  const fund: AccountData = {
    id: 'fund',
    type: 'investment',
    groupId: null,
    openingDate: null,
    openingBalanceCents: 0,
  };
  const valuations: ValuationData[] = [
    { accountId: 'fund', date: '2026-09-01', valueCents: 100000 },
    { accountId: 'fund', date: '2026-09-04', valueCents: 118000 },
  ];
  const movements: MovementData[] = [
    { accountId: 'fund', date: '2026-09-02', amountCents: 20000, kind: 'transfer' },
    { accountId: 'fund', date: '2026-09-03', amountCents: -5000, kind: 'transfer' },
  ];
  const sameDay: MovementData[] = [
    ...movements,
    { accountId: 'fund', date: '2026-09-04', amountCents: 1000, kind: 'regular' },
  ];

  it('D+2 is the valuation plus later movements', () => {
    expect(investmentValueAt(fund, valuations, movements, '2026-09-03')).toBe(115000);
  });

  it('D+3 is the new valuation', () => {
    expect(investmentValueAt(fund, valuations, movements, '2026-09-04')).toBe(118000);
  });

  it('a same-day movement is part of the valuation', () => {
    expect(investmentValueAt(fund, valuations, sameDay, '2026-09-04')).toBe(118000);
    expect(investmentValueAt(fund, valuations, sameDay, '2026-09-05')).toBe(118000);
  });

  it('without a valuation it is the balance', () => {
    expect(investmentValueAt(fund, valuations, movements, '2026-08-31')).toBe(0);
    expect(investmentValueAt(fund, [], movements, '2026-09-30')).toBe(15000);
  });
});

describe('net worth and groups', () => {
  const fundA: AccountData = { ...checking, id: 'a', type: 'investment', groupId: 'g' };
  const fundB: AccountData = { ...checking, id: 'b', type: 'investment', groupId: 'g' };
  const valuations: ValuationData[] = [
    { accountId: 'a', date: '2026-09-01', valueCents: 100000 },
    { accountId: 'b', date: '2026-09-01', valueCents: 50000 },
  ];

  it('CA-09 · groupValueAt sums only the group', () => {
    const accounts = [checking, fundA, fundB];
    expect(groupValueAt('g', accounts, checkingMovements, valuations, '2026-09-30')).toBe(150000);
    expect(netWorthAt(accounts, checkingMovements, valuations, '2026-09-30')).toBe(163000);
  });

  it('CA-07 · transfers and external contributions are not income or expense', () => {
    expect(countsAsIncomeOrExpense({ kind: 'regular' })).toBe(true);
    expect(countsAsIncomeOrExpense({ kind: 'transfer' })).toBe(false);
    expect(countsAsIncomeOrExpense({ kind: 'external' })).toBe(false);
  });
});
