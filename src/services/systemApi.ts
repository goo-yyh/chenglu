import type { BackupInfo, SystemInfo } from "../types/system";
import { mockCreateBackup, mockListBackups, mockSystemInfo } from "./mockStore";
import { invokeOrMock } from "./tauri";

export function getSystemInfo() {
  return invokeOrMock<SystemInfo>("get_system_info", {}, mockSystemInfo);
}

export function openDataDir() {
  return invokeOrMock<void>("open_data_dir", {}, () => undefined);
}

export function createBackup(description?: string | null) {
  return invokeOrMock<BackupInfo>(
    "create_backup",
    { description },
    () => mockCreateBackup(description),
  );
}

export function listLocalBackups() {
  return invokeOrMock<BackupInfo[]>("list_local_backups", {}, mockListBackups);
}
