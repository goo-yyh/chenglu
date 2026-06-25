UPDATE contracts
SET contract_amount = contract_amount * 10000,
    performance_bond_amount = CASE
      WHEN performance_bond_amount IS NULL THEN NULL
      ELSE performance_bond_amount * 10000
    END,
    warranty_bond_amount = CASE
      WHEN warranty_bond_amount IS NULL THEN NULL
      ELSE warranty_bond_amount * 10000
    END,
    prepayment_amount = CASE
      WHEN prepayment_amount IS NULL THEN NULL
      ELSE prepayment_amount * 10000
    END;

UPDATE contract_payments
SET amount = amount * 10000;

UPDATE contract_commissions
SET commission_amount = commission_amount * 10000;

UPDATE contract_supplements
SET supplement_amount = supplement_amount * 10000;

UPDATE supplement_payments
SET amount = amount * 10000;
