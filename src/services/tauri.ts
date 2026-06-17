import { invoke } from "@tauri-apps/api/core";

export function isTauriRuntime() {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

export async function invokeOrMock<T>(
  command: string,
  args: Record<string, unknown>,
  mock: () => T | Promise<T>,
): Promise<T> {
  if (isTauriRuntime()) {
    return invoke<T>(command, args);
  }
  return mock();
}
