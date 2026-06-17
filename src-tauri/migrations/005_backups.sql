CREATE TABLE IF NOT EXISTS backup_records (
  id TEXT PRIMARY KEY,
  backup_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  file_size INTEGER,
  sha256 TEXT,
  app_version TEXT,
  database_version INTEGER,
  status TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  restored_at TEXT
);
