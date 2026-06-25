CREATE TRIGGER IF NOT EXISTS trg_contract_payments_amount_limit_insert
BEFORE INSERT ON contract_payments
WHEN NEW.deleted_at IS NULL
  AND (
    SELECT COALESCE(SUM(amount), 0)
    FROM contract_payments
    WHERE contract_id = NEW.contract_id
      AND deleted_at IS NULL
  ) + NEW.amount > (
    SELECT contract_amount
    FROM contracts
    WHERE id = NEW.contract_id
      AND deleted_at IS NULL
  ) + 0.000001
BEGIN
  SELECT RAISE(ABORT, '合同收款金额不能超过合同金额');
END;

CREATE TRIGGER IF NOT EXISTS trg_contract_payments_amount_limit_update
BEFORE UPDATE OF contract_id, amount, deleted_at ON contract_payments
WHEN NEW.deleted_at IS NULL
  AND (
    SELECT COALESCE(SUM(amount), 0)
    FROM contract_payments
    WHERE contract_id = NEW.contract_id
      AND deleted_at IS NULL
      AND id <> NEW.id
  ) + NEW.amount > (
    SELECT contract_amount
    FROM contracts
    WHERE id = NEW.contract_id
      AND deleted_at IS NULL
  ) + 0.000001
BEGIN
  SELECT RAISE(ABORT, '合同收款金额不能超过合同金额');
END;

CREATE TRIGGER IF NOT EXISTS trg_contracts_payment_limit_update
BEFORE UPDATE OF contract_amount, deleted_at ON contracts
WHEN NEW.deleted_at IS NULL
  AND (
    SELECT COALESCE(SUM(amount), 0)
    FROM contract_payments
    WHERE contract_id = NEW.id
      AND deleted_at IS NULL
  ) > NEW.contract_amount + 0.000001
BEGIN
  SELECT RAISE(ABORT, '合同收款金额不能超过合同金额');
END;

CREATE TRIGGER IF NOT EXISTS trg_supplement_payments_amount_limit_insert
BEFORE INSERT ON supplement_payments
WHEN NEW.deleted_at IS NULL
  AND (
    SELECT COALESCE(SUM(amount), 0)
    FROM supplement_payments
    WHERE supplement_id = NEW.supplement_id
      AND deleted_at IS NULL
  ) + NEW.amount > (
    SELECT supplement_amount
    FROM contract_supplements
    WHERE id = NEW.supplement_id
      AND deleted_at IS NULL
  ) + 0.000001
BEGIN
  SELECT RAISE(ABORT, '增补合同收款金额不能超过增加合同金额');
END;

CREATE TRIGGER IF NOT EXISTS trg_supplement_payments_amount_limit_update
BEFORE UPDATE OF supplement_id, amount, deleted_at ON supplement_payments
WHEN NEW.deleted_at IS NULL
  AND (
    SELECT COALESCE(SUM(amount), 0)
    FROM supplement_payments
    WHERE supplement_id = NEW.supplement_id
      AND deleted_at IS NULL
      AND id <> NEW.id
  ) + NEW.amount > (
    SELECT supplement_amount
    FROM contract_supplements
    WHERE id = NEW.supplement_id
      AND deleted_at IS NULL
  ) + 0.000001
BEGIN
  SELECT RAISE(ABORT, '增补合同收款金额不能超过增加合同金额');
END;

CREATE TRIGGER IF NOT EXISTS trg_supplements_payment_limit_update
BEFORE UPDATE OF supplement_amount, deleted_at ON contract_supplements
WHEN NEW.deleted_at IS NULL
  AND (
    SELECT COALESCE(SUM(amount), 0)
    FROM supplement_payments
    WHERE supplement_id = NEW.id
      AND deleted_at IS NULL
  ) > NEW.supplement_amount + 0.000001
BEGIN
  SELECT RAISE(ABORT, '增补合同收款金额不能超过增加合同金额');
END;
