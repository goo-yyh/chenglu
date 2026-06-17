CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  biz_type TEXT NOT NULL,
  biz_id TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  stored_file_name TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  sha256 TEXT,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_attachments_biz ON attachments(biz_type, biz_id);
