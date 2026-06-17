CREATE TABLE IF NOT EXISTS contract_supplements (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  supplement_amount REAL NOT NULL DEFAULT 0,
  supplement_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY(contract_id) REFERENCES contracts(id)
);

CREATE TABLE IF NOT EXISTS supplement_payments (
  id TEXT PRIMARY KEY,
  supplement_id TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  paid_at TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY(supplement_id) REFERENCES contract_supplements(id)
);

CREATE INDEX IF NOT EXISTS idx_contract_supplements_contract_id ON contract_supplements(contract_id);
CREATE INDEX IF NOT EXISTS idx_supplement_payments_supplement_id ON supplement_payments(supplement_id);
