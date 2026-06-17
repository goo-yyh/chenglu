export interface SystemInfo {
  dataRoot: string;
  databaseFile: string;
  attachmentsDir: string;
  backupsDir: string;
}

export interface BackupInfo {
  id: string;
  backupType: string;
  fileName: string;
  relativePath: string;
  fileSize?: number | null;
  sha256?: string | null;
  status: string;
  description?: string | null;
  createdAt: string;
  restoredAt?: string | null;
}
