ALTER TABLE attachments ADD COLUMN category TEXT;

UPDATE attachments
SET category = CASE
  WHEN biz_type = 'contract_supplement' THEN 'supplement_file'
  ELSE 'contract_file'
END
WHERE category IS NULL OR category = '';

CREATE INDEX IF NOT EXISTS idx_attachments_biz_category
ON attachments(biz_type, biz_id, category);
