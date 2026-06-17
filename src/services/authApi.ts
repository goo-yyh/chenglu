import { invokeOrMock } from "./tauri";
import { mockValidateLogin } from "./mockStore";

export function validateLogin(account: string, password: string) {
  return invokeOrMock<boolean>(
    "validate_login",
    { input: { account, password } },
    () => mockValidateLogin(account, password),
  );
}
