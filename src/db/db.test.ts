import { readdirSync, readFileSync } from 'node:fs';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { beforeEach, describe, expect, it } from 'vitest';
import { countsAsIncomeOrExpense } from '../domain/balance';
import { runCall } from './api';
import { errorCode } from './errors';
import { loadMigrations, migrate, schemaVersion } from './migrate';
import { archiveAccount, createAccount, createGroup } from './repo/accounts';
import { recordBalanceCheck } from './repo/balance-checks';
import { createMovement, linkTransfer, setKind, unlinkTransfer } from './repo/movements';
import { netWorth, groupValue, accountBalance } from './repo/queries';
import { createValuation, deleteValuation } from './repo/valuations';
import { upsertSourceLink } from './repo/links';
import { newId, now } from './repo/common';
import { type SqlDb, wrapDatabase } from './sql';

// Node build of sqlite-wasm with an in-memory database (SPEC-0004 §1).
const sqlite3 = await sqlite3InitModule();
const dir = new URL('./migrations/', import.meta.url);
const migrations = loadMigrations(
  Object.fromEntries(
    readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => [f, readFileSync(new URL(f, dir), 'utf8')]),
  ),
);

const TABLES = [
  'account_group',
  'account',
  'source_link',
  'category',
  'category_map',
  'category_rule',
  'movement',
  'valuation',
  'import_batch',
  'import_template',
  'balance_check',
  'sync_state',
  'sync_clock',
  'sync_outbox',
  'sync_applied',
  'sync_notice',
];

function emptyDb(): SqlDb {
  return wrapDatabase(new sqlite3.oo1.DB(':memory:'));
}

function freshDb(): SqlDb {
  const db = emptyDb();
  migrate(db, migrations);
  return db;
}

const tables = (db: SqlDb) =>
  db
    .all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
    .map((r) => r.name);

describe('CA-01 · migrations', () => {
  it('creates every table and records version 1', () => {
    const db = freshDb();
    expect(tables(db)).toEqual(expect.arrayContaining([...TABLES, 'schema_migrations']));
    expect(schemaVersion(db)?.version).toBe(1);
    expect(schemaVersion(db)?.appliedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it('a second migrate does nothing', () => {
    const db = freshDb();
    const before = schemaVersion(db);
    migrate(db, migrations);
    expect(db.all('SELECT * FROM schema_migrations')).toHaveLength(1);
    expect(schemaVersion(db)).toEqual(before);
  });

  it('a failing migration leaves the version at 1 and none of its objects', () => {
    const db = emptyDb();
    const failing = {
      version: 2,
      name: 'failing',
      sql: 'CREATE TABLE extra (id TEXT); CREATE INDEX extra_id ON extra (id); SELECT * FROM missing_table;',
    };
    expect(() => migrate(db, [...migrations, failing])).toThrow(/missing_table/);
    expect(schemaVersion(db)?.version).toBe(1);
    expect(db.all("SELECT name FROM sqlite_master WHERE name LIKE 'extra%'")).toEqual([]);
  });
});

function insertCategory(db: SqlDb, parentId: string | null = null): string {
  const id = newId();
  const ts = now();
  db.run(
    'INSERT INTO category (id, parent_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [id, parentId, 'Synthetic', ts, ts],
  );
  return id;
}

function insertBatch(db: SqlDb): string {
  const id = newId();
  const ts = now();
  db.run(
    `INSERT INTO import_batch (id, source, file_name, file_sha256, created_at, updated_at)
     VALUES (?, 'test', 'synthetic.xlsx', 'abc', ?, ?)`,
    [id, ts, ts],
  );
  return id;
}

function insertRule(db: SqlDb, categoryId: string, patternNorm: string): string {
  const id = newId();
  const ts = now();
  db.run(
    `INSERT INTO category_rule (id, pattern, pattern_norm, category_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, patternNorm, patternNorm, categoryId, ts, ts],
  );
  return id;
}

function softDelete(db: SqlDb, table: string, id: string) {
  db.run(`UPDATE ${table} SET deleted_at = ? WHERE id = ?`, [now(), id]);
}

describe('CA-02 · constraints', () => {
  let db: SqlDb;
  let checking: string;
  let savings: string;
  beforeEach(() => {
    db = freshDb();
    checking = createAccount(db, { name: 'Corriente', type: 'checking' });
    savings = createAccount(db, { name: 'Ahorro', type: 'savings' });
  });

  it('a third category level fails with category_depth', () => {
    const top = insertCategory(db);
    const child = insertCategory(db, top);
    expect(() => insertCategory(db, child)).toThrow(/category_depth/);
  });

  it('giving a parent to a category with children fails with category_depth', () => {
    const top = insertCategory(db);
    const other = insertCategory(db);
    insertCategory(db, other);
    expect(() => db.run('UPDATE category SET parent_id = ? WHERE id = ?', [top, other])).toThrow(
      /category_depth/,
    );
  });

  it('category depth is not enforced while merging, and is again afterwards', () => {
    const top = insertCategory(db);
    const child = insertCategory(db, top);
    db.run("INSERT INTO sync_state (key, value) VALUES ('merging', '1')");
    expect(() => insertCategory(db, child)).not.toThrow();
    db.run("DELETE FROM sync_state WHERE key = 'merging'");
    expect(() => insertCategory(db, child)).toThrow(/category_depth/);
  });

  it('linkTransfer on an external movement fails with transfer_invalid', () => {
    const a = createMovement(db, { accountId: savings, date: '2026-09-01', amountCents: 30000 });
    const b = createMovement(db, { accountId: checking, date: '2026-09-01', amountCents: -30000 });
    setKind(db, a, 'external');
    expect(() => linkTransfer(db, a, b)).toThrow(
      expect.objectContaining({ code: 'transfer_invalid' }),
    );
  });

  it('external with a negative amount fails a CHECK', () => {
    expect(() =>
      createMovement(db, {
        accountId: checking,
        date: '2026-09-01',
        amountCents: -100,
        kind: 'external',
      }),
    ).toThrow(/CHECK/);
  });

  it('transfer without group, or regular with group, fails a CHECK', () => {
    const id = createMovement(db, { accountId: checking, date: '2026-09-01', amountCents: -100 });
    expect(() => db.run("UPDATE movement SET kind = 'transfer' WHERE id = ?", [id])).toThrow(
      /CHECK/,
    );
    expect(() => db.run("UPDATE movement SET transfer_group_id = 'g' WHERE id = ?", [id])).toThrow(
      /CHECK/,
    );
  });

  it('a valuation on a checking account fails with valuation_account_type', () => {
    expect(() =>
      createValuation(db, { accountId: checking, date: '2026-09-01', valueCents: 1 }),
    ).toThrow(/valuation_account_type/);
  });

  it('amount_cents = 0 fails a CHECK', () => {
    expect(() =>
      createMovement(db, { accountId: checking, date: '2026-09-01', amountCents: 0 }),
    ).toThrow(/CHECK/);
  });

  it("type='loan' fails a CHECK", () => {
    expect(() =>
      createAccount(db, { name: 'Préstamo', type: 'loan' as unknown as 'checking' }),
    ).toThrow(/CHECK/);
  });

  it('an isin on a savings account fails a CHECK', () => {
    expect(() =>
      createAccount(db, { name: 'Ahorro', type: 'savings', isin: 'ES0000000000' }),
    ).toThrow(/CHECK/);
  });

  it('a missing foreign key fails', () => {
    expect(() =>
      createMovement(db, { accountId: 'missing', date: '2026-09-01', amountCents: 100 }),
    ).toThrow(/FOREIGN KEY/);
  });

  it('two live source_link with the same (source, key) fail UNIQUE; after a soft delete it works', () => {
    const ts = now();
    const insert = () => {
      const id = newId();
      db.run(
        `INSERT INTO source_link (id, source, key, account_id, created_at, updated_at)
         VALUES (?, 'bbva', 'ES00 SYNTHETIC', ?, ?, ?)`,
        [id, checking, ts, ts],
      );
      return id;
    };
    const first = insert();
    expect(insert).toThrow(/UNIQUE/);
    softDelete(db, 'source_link', first);
    expect(insert).not.toThrow();
  });

  it('two live category_rule with the same pattern_norm fail UNIQUE; after a soft delete it works', () => {
    const category = insertCategory(db);
    const first = insertRule(db, category, 'MERCADONA');
    expect(() => insertRule(db, category, 'MERCADONA')).toThrow(/UNIQUE/);
    softDelete(db, 'category_rule', first);
    expect(() => insertRule(db, category, 'MERCADONA')).not.toThrow();
  });

  it('two live valuations with the same (account_id, date) fail UNIQUE; after a soft delete it works', () => {
    const fund = createAccount(db, { name: 'Fondo', type: 'investment' });
    const value = { accountId: fund, date: '2026-09-01', valueCents: 100000 };
    const first = createValuation(db, value);
    expect(() => createValuation(db, value)).toThrow(/UNIQUE/);
    deleteValuation(db, first);
    expect(() => createValuation(db, value)).not.toThrow();
  });

  it('account.created_by_batch_id with a missing batch fails FOREIGN KEY; NULL is allowed', () => {
    expect(() =>
      createAccount(db, { name: 'X', type: 'cash', createdByBatchId: 'missing' }),
    ).toThrow(/FOREIGN KEY/);
    expect(() =>
      createAccount(db, { name: 'X', type: 'cash', createdByBatchId: null }),
    ).not.toThrow();
    expect(() => createGroup(db, { name: 'G', createdByBatchId: null })).not.toThrow();
    const batch = insertBatch(db);
    expect(() => createGroup(db, { name: 'G', createdByBatchId: batch })).not.toThrow();
  });

  it('upsertSourceLink keeps a single live link per (source, key)', () => {
    const first = upsertSourceLink(db, { source: 'bbva', key: 'K', accountId: checking });
    const second = upsertSourceLink(db, { source: 'bbva', key: 'K', accountId: savings });
    expect(second).toBe(first);
    expect(db.get('SELECT account_id AS a FROM source_link WHERE id = ?', [first])).toEqual({
      a: savings,
    });
  });

  it('errors map to protocol codes', () => {
    const thrown = (fn: () => unknown) => {
      try {
        fn();
      } catch (err) {
        return err;
      }
      throw new Error('expected an error');
    };
    const top = insertCategory(db);
    const child = insertCategory(db, top);
    expect(errorCode(thrown(() => insertCategory(db, child)))).toBe('category_depth');
    expect(
      errorCode(
        thrown(() =>
          runCall(db, 'createMovement', {
            accountId: 'missing',
            date: '2026-09-01',
            amountCents: 1,
          }),
        ),
      ),
    ).toBe('constraint');
    expect(
      errorCode(thrown(() => runCall(db, 'linkTransfer', { movementIdA: 'x', movementIdB: 'y' }))),
    ).toBe('transfer_invalid');
  });
});

describe('API calls', () => {
  it('a failing call rolls back everything it wrote', () => {
    const db = freshDb();
    const before = db.all('SELECT * FROM account');
    // createAccount writes, then the nested savepoint fails: nothing of the call stays.
    expect(() =>
      db.transaction(() => {
        createAccount(db, { name: 'A', type: 'checking' });
        createAccount(db, { name: 'B', type: 'savings', isin: 'X' });
      }),
    ).toThrow(/CHECK/);
    expect(db.all('SELECT * FROM account')).toEqual(before);
    expect(runCall(db, 'schemaVersion', {})).toEqual(schemaVersion(db));
  });
});

/** CA-05 account: opening 2026-09-01 with 100,00 €, +50,00 € on 09-05 and −20,00 € on 09-10. */
function ca05(db: SqlDb): string {
  const id = createAccount(db, {
    name: 'Corriente',
    type: 'checking',
    openingDate: '2026-09-01',
    openingBalanceCents: 10000,
  });
  createMovement(db, { accountId: id, date: '2026-09-05', amountCents: 5000 });
  createMovement(db, { accountId: id, date: '2026-09-10', amountCents: -2000 });
  return id;
}

describe('CA-07 · transfers and external contributions', () => {
  it('linkTransfer pairs two opposite movements in different accounts', () => {
    const db = freshDb();
    const a = createAccount(db, { name: 'A', type: 'checking' });
    const b = createAccount(db, { name: 'B', type: 'savings' });
    const out = createMovement(db, { accountId: a, date: '2026-09-01', amountCents: -30000 });
    const inn = createMovement(db, { accountId: b, date: '2026-09-01', amountCents: 30000 });
    const before = netWorth(db, '2026-09-30');

    const group = linkTransfer(db, out, inn);
    const rows = db.all<{ kind: 'transfer'; transfer_group_id: string }>(
      'SELECT kind, transfer_group_id FROM movement ORDER BY id',
    );
    expect(rows).toEqual([
      { kind: 'transfer', transfer_group_id: group },
      { kind: 'transfer', transfer_group_id: group },
    ]);
    expect(netWorth(db, '2026-09-30')).toBe(before);
    expect(rows.map(countsAsIncomeOrExpense)).toEqual([false, false]);

    unlinkTransfer(db, group);
    expect(db.all('SELECT DISTINCT kind, transfer_group_id AS g FROM movement')).toEqual([
      { kind: 'regular', g: null },
    ]);
  });

  it('linkTransfer with non-opposite amounts or in the same account fails', () => {
    const db = freshDb();
    const a = createAccount(db, { name: 'A', type: 'checking' });
    const b = createAccount(db, { name: 'B', type: 'savings' });
    const m1 = createMovement(db, { accountId: a, date: '2026-09-01', amountCents: -30000 });
    const m2 = createMovement(db, { accountId: b, date: '2026-09-01', amountCents: 29999 });
    const m3 = createMovement(db, { accountId: a, date: '2026-09-01', amountCents: 30000 });
    const invalid = expect.objectContaining({ code: 'transfer_invalid' });
    expect(() => linkTransfer(db, m1, m2)).toThrow(invalid);
    expect(() => linkTransfer(db, m1, m3)).toThrow(invalid);
    const m4 = createMovement(db, { accountId: b, date: '2026-09-01', amountCents: 30000 });
    linkTransfer(db, m1, m4);
    const m5 = createMovement(db, { accountId: b, date: '2026-09-02', amountCents: 30000 });
    expect(() => linkTransfer(db, m1, m5)).toThrow(invalid);
  });

  it('an external contribution adds to net worth and is not income', () => {
    const db = freshDb();
    const a = createAccount(db, { name: 'A', type: 'checking' });
    const before = netWorth(db, '2026-09-30');
    const id = createMovement(db, { accountId: a, date: '2026-09-01', amountCents: 100000 });
    setKind(db, id, 'external');
    expect(netWorth(db, '2026-09-30')).toBe(before + 100000);
    const row = db.get<{ kind: 'external' }>('SELECT kind FROM movement WHERE id = ?', [id]);
    expect(row?.kind).toBe('external');
    expect(countsAsIncomeOrExpense(row!)).toBe(false);
  });
});

describe('CA-08 · recordBalanceCheck', () => {
  it('stores the check and returns computed − expected', () => {
    const db = freshDb();
    const account = ca05(db);
    expect(accountBalance(db, account, '2026-09-30')).toBe(13000);
    expect(
      recordBalanceCheck(db, { accountId: account, date: '2026-09-30', expectedCents: 13000 }).diff,
    ).toBe(0);
    const check = recordBalanceCheck(db, {
      accountId: account,
      date: '2026-09-30',
      expectedCents: 12900,
    });
    expect(check.diff).toBe(100);
    expect(
      db.get(
        'SELECT expected_cents AS e, computed_cents AS c, source, import_batch_id AS b FROM balance_check WHERE id = ?',
        [check.id],
      ),
    ).toEqual({
      e: 12900,
      c: 13000,
      source: 'user',
      b: null,
    });

    const batch = insertBatch(db);
    const fromFile = recordBalanceCheck(db, {
      accountId: account,
      date: '2026-09-30',
      expectedCents: 13000,
      source: 'file',
      importBatchId: batch,
    });
    expect(
      db.get('SELECT source, import_batch_id AS b FROM balance_check WHERE id = ?', [fromFile.id]),
    ).toEqual({
      source: 'file',
      b: batch,
    });
  });
});

describe('CA-09 · groupValue', () => {
  it('sums the group accounts, archived ones included', () => {
    const db = freshDb();
    const group = createGroup(db, { name: 'Cartera' });
    const f1 = createAccount(db, { name: 'Fondo 1', type: 'investment', groupId: group });
    const f2 = createAccount(db, { name: 'Fondo 2', type: 'investment', groupId: group });
    const other = createAccount(db, { name: 'Fuera', type: 'investment' });
    createValuation(db, {
      accountId: f1,
      date: '2026-09-01',
      valueCents: 100000,
      units: '12.345678',
    });
    createValuation(db, { accountId: f2, date: '2026-09-01', valueCents: 50000 });
    createValuation(db, { accountId: other, date: '2026-09-01', valueCents: 70000 });
    expect(groupValue(db, group, '2026-09-30')).toBe(150000);
    archiveAccount(db, f2);
    expect(groupValue(db, group, '2026-09-30')).toBe(150000);
    expect(netWorth(db, '2026-09-30')).toBe(220000);
  });
});
