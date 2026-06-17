CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  contract_date TEXT NOT NULL,
  project_name TEXT NOT NULL,
  owner_unit TEXT NOT NULL,
  contract_amount REAL NOT NULL DEFAULT 0,
  performance_bond_enabled INTEGER NOT NULL DEFAULT 0,
  performance_bond_amount REAL,
  performance_bond_type TEXT,
  performance_bond_return_due_at TEXT,
  performance_bond_returned INTEGER NOT NULL DEFAULT 0,
  warranty_bond_enabled INTEGER NOT NULL DEFAULT 0,
  warranty_bond_amount REAL,
  warranty_bond_type TEXT,
  warranty_bond_return_due_at TEXT,
  warranty_bond_returned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS contract_contacts (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  position TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY(contract_id) REFERENCES contracts(id)
);

CREATE TABLE IF NOT EXISTS contract_payments (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  paid_at TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY(contract_id) REFERENCES contracts(id)
);

CREATE TABLE IF NOT EXISTS contract_commissions (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  salesperson TEXT NOT NULL,
  commission_amount REAL NOT NULL DEFAULT 0,
  commission_paid_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY(contract_id) REFERENCES contracts(id)
);

CREATE INDEX IF NOT EXISTS idx_contract_contacts_contract_id ON contract_contacts(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_payments_contract_id ON contract_payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_commissions_contract_id ON contract_commissions(contract_id);
