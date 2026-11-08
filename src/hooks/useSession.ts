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
import type { Translate, TranslationKey } from "../i18n";

export type AuthMode = "login" | "register";

const MIN_LOGIN_LENGTH = 3;
const MIN_PASSWORD_LENGTH = 6;

export function useSession(t: Translate) {
  const submitting = useRef(false);
  const authGeneration = useRef(0);
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, updateAuthMode] = useState<AuthMode>("login");
  const [authLogin, updateAuthLogin] = useState("");
  const [authPassword, updateAuthPassword] = useState("");
  const [rememberSession, setRememberSession] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authErrorKey, setAuthErrorKey] = useState<TranslationKey | null>(null);
  const setAuthMode = (value: AuthMode) => {
    updateAuthMode(value);
    setAuthErrorKey(null);
  };
  const setAuthLogin = (value: string) => {
    updateAuthLogin(value);
    setAuthErrorKey(null);
  };
  const setAuthPassword = (value: string) => {
    updateAuthPassword(value);
    setAuthErrorKey(null);
  };

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
      setAuthErrorKey("authLoginTooShort");
      return;
    }
    if (authPassword.length < MIN_PASSWORD_LENGTH) {
      setAuthErrorKey("authPasswordTooShort");
      return;
    }

    if (!/^[a-zA-Z0-9_-]{3,32}$/.test(authLogin.trim())) {
      setAuthErrorKey("authLoginFormat");
      return;
    }
    const generation = authGeneration.current;
    setAuthErrorKey(null);
    setAuthBusy(true);
    submitting.current = true;
    try {
      const result =
        authMode === "register"
          ? await registerRequest(normalized, authPassword)
          : await loginRequest(normalized, authPassword);
      if (generation !== authGeneration.current) return;
      if (!result.ok) {
        setAuthErrorKey(authFailureKey(authMode, result.status));
        return;
      }
      try {
        saveSession(result.session, rememberSession);
      } catch {
        setAuthErrorKey("authStorageError");
        return;
      }
      setSession(result.session);
      setAuthLogin("");
      setAuthPassword("");
    } catch {
      if (generation === authGeneration.current) setAuthErrorKey("authUnavailable");
    } finally {
      if (generation === authGeneration.current) {
        submitting.current = false;
        setAuthBusy(false);
      }
    }
  };

  const switchAccount = () => {
    authGeneration.current += 1;
    submitting.current = false;
    clearSession();
    setAuthBusy(false);
    setSession(null);
    setAuthLogin("");
    setAuthPassword("");
  };

  /** Сервер ответил 401: токен протух/отозван — честно разлогиниваем. */
  const invalidateSession = () => {
    // Ignore duplicate 401s after the stored session has already been cleared.
    if (!loadSession()) return;
    authGeneration.current += 1;
    submitting.current = false;
    clearSession();
    setAuthBusy(false);
    setSession(null);
    setAuthErrorKey("sessionExpired");
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
    rememberSession,
    setRememberSession,
    authBusy,
    authError: authErrorKey ? t(authErrorKey) : "",
    submitAuth,
    switchAccount,
    invalidateSession
  };
}
