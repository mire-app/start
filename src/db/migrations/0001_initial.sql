-- SPEC-0004 §4: initial schema.
-- User tables: id (UUIDv7), created_at, updated_at, deleted_at (ISO-8601 UTC); soft delete only.
-- Business dates are YYYY-MM-DD, money is *_cents INTEGER in EUR, fund units are decimal TEXT.
-- UNIQUE constraints are partial indexes over live rows (deleted_at IS NULL).

-- Local sync tables (SPEC-0008): no common columns, never synced nor exported.
CREATE TABLE sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE sync_clock (
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  field TEXT NOT NULL,
  hlc TEXT NOT NULL,
  PRIMARY KEY (table_name, row_id, field)
);

CREATE TABLE sync_outbox (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  field TEXT NOT NULL,
  value TEXT NOT NULL,
  hlc TEXT NOT NULL
);
CREATE INDEX sync_outbox_hlc ON sync_outbox (hlc);

CREATE TABLE sync_applied (
  path TEXT PRIMARY KEY,
  sha TEXT NOT NULL
);

CREATE TABLE sync_notice (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  seen_at TEXT
);

-- User tables.
CREATE TABLE import_batch (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_sha256 TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  reverted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE account_group (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by_batch_id TEXT REFERENCES import_batch (id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE account (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'cash', 'investment')),
  institution TEXT,
  group_id TEXT REFERENCES account_group (id),
  isin TEXT CHECK (isin IS NULL OR type = 'investment'),
  opening_date TEXT,
  opening_balance_cents INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_by_batch_id TEXT REFERENCES import_batch (id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX account_group_id ON account (group_id);

CREATE TABLE source_link (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  key TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES account (id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE UNIQUE INDEX source_link_source_key ON source_link (source, key) WHERE deleted_at IS NULL;

CREATE TABLE category (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES category (id),
  system_key TEXT,
  name TEXT NOT NULL,
  icon TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX category_parent_id ON category (parent_id);

-- Two levels at most. Not enforced while SPEC-0008 merges (it repairs afterwards).
CREATE TRIGGER category_depth_insert BEFORE INSERT ON category
WHEN NEW.parent_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sync_state WHERE key = 'merging')
  AND (
    EXISTS (SELECT 1 FROM category WHERE id = NEW.parent_id AND parent_id IS NOT NULL)
    OR EXISTS (SELECT 1 FROM category WHERE parent_id = NEW.id AND deleted_at IS NULL)
  )
BEGIN
  SELECT RAISE(ABORT, 'category_depth');
END;

CREATE TRIGGER category_depth_update BEFORE UPDATE OF parent_id ON category
WHEN NEW.parent_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sync_state WHERE key = 'merging')
  AND (
    EXISTS (SELECT 1 FROM category WHERE id = NEW.parent_id AND parent_id IS NOT NULL)
    OR EXISTS (SELECT 1 FROM category WHERE parent_id = NEW.id AND deleted_at IS NULL)
  )
BEGIN
  SELECT RAISE(ABORT, 'category_depth');
END;

CREATE TABLE category_map (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_category TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES category (id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE UNIQUE INDEX category_map_source_category ON category_map (source, source_category)
WHERE deleted_at IS NULL;

CREATE TABLE category_rule (
  id TEXT PRIMARY KEY,
  pattern TEXT NOT NULL,
  pattern_norm TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES category (id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE UNIQUE INDEX category_rule_pattern_norm ON category_rule (pattern_norm)
WHERE deleted_at IS NULL;

CREATE TABLE movement (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES account (id),
  date TEXT NOT NULL,
  value_date TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents <> 0),
  description TEXT NOT NULL DEFAULT '',
  note TEXT,
  kind TEXT NOT NULL DEFAULT 'regular' CHECK (kind IN ('regular', 'transfer', 'external')),
  category_id TEXT REFERENCES category (id),
  transfer_group_id TEXT,
  import_batch_id TEXT REFERENCES import_batch (id),
  fingerprint TEXT,
  source_category TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  CHECK (kind <> 'external' OR amount_cents > 0),
  CHECK ((kind = 'transfer') = (transfer_group_id IS NOT NULL))
);
CREATE INDEX movement_account_date ON movement (account_id, date);
CREATE INDEX movement_fingerprint ON movement (fingerprint);
CREATE INDEX movement_transfer_group_id ON movement (transfer_group_id);

CREATE TABLE valuation (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES account (id),
  date TEXT NOT NULL,
  value_cents INTEGER NOT NULL,
  units TEXT,
  import_batch_id TEXT REFERENCES import_batch (id),
  deleted_by_batch_id TEXT REFERENCES import_batch (id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE UNIQUE INDEX valuation_account_date ON valuation (account_id, date) WHERE deleted_at IS NULL;

-- Valuations only on investment accounts. Not enforced while SPEC-0008 merges.
CREATE TRIGGER valuation_account_type_insert BEFORE INSERT ON valuation
WHEN NOT EXISTS (SELECT 1 FROM sync_state WHERE key = 'merging')
  AND EXISTS (SELECT 1 FROM account WHERE id = NEW.account_id AND type <> 'investment')
BEGIN
  SELECT RAISE(ABORT, 'valuation_account_type');
END;

CREATE TRIGGER valuation_account_type_update BEFORE UPDATE OF account_id ON valuation
WHEN NOT EXISTS (SELECT 1 FROM sync_state WHERE key = 'merging')
  AND EXISTS (SELECT 1 FROM account WHERE id = NEW.account_id AND type <> 'investment')
BEGIN
  SELECT RAISE(ABORT, 'valuation_account_type');
END;

CREATE TABLE import_template (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('csv', 'xlsx')),
  settings TEXT NOT NULL,
  last_used_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE balance_check (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES account (id),
  date TEXT NOT NULL,
  expected_cents INTEGER NOT NULL,
  computed_cents INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('file', 'user')),
  import_batch_id TEXT REFERENCES import_batch (id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX balance_check_account_date ON balance_check (account_id, date);
