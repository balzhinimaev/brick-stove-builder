import { useEffect, useRef, useState } from "react";
import {
  clearSession,
  loadSession,
  login as loginRequest,
  normalizeLogin,
  register as registerRequest,
  saveSession,
  type Session
} from "../api/client";
import { authFailureKey } from "../api/authFailure";
import type { Translate } from "../i18n";

export type AuthMode = "login" | "register";

const MIN_LOGIN_LENGTH = 3;
const MIN_PASSWORD_LENGTH = 6;

export function useSession(t: Translate) {
  const submitting = useRef(false);
  const authGeneration = useRef(0);
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authLogin, setAuthLogin] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  useEffect(() => {
    const stored = loadSession();
    if (stored) setSession(stored);
    return () => {
      authGeneration.current += 1;
      submitting.current = false;
    };
  }, []);

  const submitAuth = async () => {
    if (submitting.current) return;
    const normalized = normalizeLogin(authLogin);
    if (normalized.length < MIN_LOGIN_LENGTH) {
      window.alert(t("authLoginTooShort"));
      return;
    }
    if (authPassword.length < MIN_PASSWORD_LENGTH) {
      window.alert(t("authPasswordTooShort"));
      return;
    }

    const generation = authGeneration.current;
    submitting.current = true;
    try {
      const result =
        authMode === "register"
          ? await registerRequest(normalized, authPassword)
          : await loginRequest(normalized, authPassword);
      if (generation !== authGeneration.current) return;
      if (!result.ok) {
        window.alert(t(authFailureKey(authMode, result.status)));
        return;
      }
      saveSession(result.session);
      setSession(result.session);
      setAuthLogin("");
      setAuthPassword("");
    } catch {
      if (generation === authGeneration.current) window.alert(t("authUnavailable"));
    } finally {
      if (generation === authGeneration.current) submitting.current = false;
    }
  };

  const switchAccount = () => {
    authGeneration.current += 1;
    submitting.current = false;
    clearSession();
    setSession(null);
    setAuthLogin("");
    setAuthPassword("");
  };

  /** Сервер ответил 401: токен протух/отозван — честно разлогиниваем. */
  const invalidateSession = () => {
    // Несколько параллельных 401 не должны показать несколько alert'ов.
    if (!loadSession()) return;
    authGeneration.current += 1;
    submitting.current = false;
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
