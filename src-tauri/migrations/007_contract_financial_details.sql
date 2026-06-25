ALTER TABLE contracts ADD COLUMN prepayment_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contracts ADD COLUMN prepayment_amount REAL;
ALTER TABLE contracts ADD COLUMN prepayment_type TEXT;
ALTER TABLE contracts ADD COLUMN warranty_bond_reserve_percent INTEGER;
