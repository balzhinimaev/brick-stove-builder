import { useEffect, useState } from "react";
import {
  clearSession,
  loadSession,
  login as loginRequest,
  normalizeLogin,
  register as registerRequest,
  saveSession,
  type Session
} from "../api/client";
import type { Translate } from "../i18n";

export type AuthMode = "login" | "register";

const MIN_LOGIN_LENGTH = 3;
const MIN_PASSWORD_LENGTH = 6;

export function useSession(t: Translate) {
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authLogin, setAuthLogin] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  useEffect(() => {
    const stored = loadSession();
    if (stored) setSession(stored);
  }, []);

  const submitAuth = async () => {
    const normalized = normalizeLogin(authLogin);
    if (normalized.length < MIN_LOGIN_LENGTH) {
      window.alert(t("authLoginTooShort"));
      return;
    }
    if (authPassword.length < MIN_PASSWORD_LENGTH) {
      window.alert(t("authPasswordTooShort"));
      return;
    }

    const result = authMode === "register"
      ? await registerRequest(normalized, authPassword)
      : await loginRequest(normalized, authPassword);

    if (!result.ok) {
      window.alert(authMode === "register" && result.status === 409 ? t("authTaken") : t("authBadCredentials"));
      return;
    }

    saveSession(result.session);
    setSession(result.session);
    setAuthLogin("");
    setAuthPassword("");
  };

  const switchAccount = () => {
    clearSession();
    setSession(null);
    setAuthLogin("");
    setAuthPassword("");
  };

  /** Сервер ответил 401: токен протух/отозван — честно разлогиниваем. */
  const invalidateSession = () => {
    // Несколько параллельных 401 не должны показать несколько alert'ов.
    if (!loadSession()) return;
    clearSession();
    setSession(null);
    window.alert(t("sessionExpired"));
  };

  return {
    session,
    userLogin: session?.login ?? "",
    authMode,
    setAuthMode,
    authLogin,
    setAuthLogin,
    authPassword,
    setAuthPassword,
    submitAuth,
    switchAccount,
    invalidateSession
  };
}
