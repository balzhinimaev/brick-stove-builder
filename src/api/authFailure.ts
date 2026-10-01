export function authFailureKey(mode: "login" | "register", status: number) {
  if (mode === "register" && status === 409) return "authTaken";
  if (status === 400 || status === 401) return "authBadCredentials";
  return "authUnavailable";
}
