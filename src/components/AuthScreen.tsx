import { useId, useState } from "react";
import type { Translate } from "../i18n";
import type { AuthMode } from "../hooks/useSession";

export function AuthScreen({
  mode,
  setMode,
  login,
  setLogin,
  password,
  setPassword,
  onSubmit,
  t,
  busy = false,
  error = "",
  remember = true,
  setRemember,
  onContinue
}: {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  login: string;
  setLogin: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  onSubmit: () => void;
  t: Translate;
  busy?: boolean;
  error?: string;
  remember?: boolean;
  setRemember?: (value: boolean) => void;
  onContinue?: () => void;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const message = mismatch ? t("authPasswordMismatch") : error;
  return (
    <main className="site-page auth-page">
      <section className="auth-story">
        <p className="eyebrow">{t("workspaceLabel")}</p>
        <h1>{t(mode === "register" ? "authRegisterTitle" : "authIntro")}</h1>
        <p className="auth-lead">{t("authSubtitle")}</p>
        <div className="auth-benefit">
          <span aria-hidden="true">01</span>
          <div>
            <h2>{t("continueEditing")}</h2>
            <p>{t("authGuestHint")}</p>
          </div>
        </div>
        <div className="auth-benefit">
          <span aria-hidden="true">02</span>
          <div>
            <h2>{t("accountBenefit")}</h2>
            <p>{t("accountStorageHint")}</p>
          </div>
        </div>
        <details className="auth-library-note">
          <summary>{t("libraryTitle")}</summary>
          <p>{t("authWorkspaceHint")}</p>
        </details>
      </section>
      <section className="auth-card" aria-label={t("authTitle")}>
        <div className="auth-tabs">
          {(["login", "register"] as const).map((item) => (
            <button
              key={item}
              type="button"
              disabled={busy}
              aria-pressed={mode === item}
              onClick={() => {
                setMode(item);
                setMismatch(false);
                setConfirmation("");
                setVisible(false);
              }}
            >
              {t(item === "login" ? "authLogin" : "authRegister")}
            </button>
          ))}
        </div>
        <form
          aria-busy={busy}
          onSubmit={(event) => {
            event.preventDefault();
            if (busy) return;
            if (mode === "register" && password !== confirmation) {
              setMismatch(true);
              return;
            }
            setMismatch(false);
            onSubmit();
          }}
        >
          <fieldset disabled={busy} className="auth-fields">
            <label htmlFor={`${id}-login`}>{t("authLoginPlaceholder")}</label>
            <input
              id={`${id}-login`}
              name="username"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              minLength={3}
              maxLength={32}
              aria-describedby={`${id}-login-help`}
            />
            <p id={`${id}-login-help`} className="field-help">
              {t("authLoginHint")}
            </p>
            <label htmlFor={`${id}-password`}>{t("authPasswordPlaceholder")}</label>
            <div className="password-field">
              <input
                id={`${id}-password`}
                name="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setMismatch(false);
                }}
                type={visible ? "text" : "password"}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                required
                minLength={6}
                maxLength={256}
                aria-describedby={mode === "register" ? `${id}-password-help` : undefined}
              />
              <button
                type="button"
                aria-controls={`${id}-password`}
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
              >
                {t(visible ? "authHidePassword" : "authShowPassword")}
              </button>
            </div>
            {mode === "register" && (
              <>
                <p id={`${id}-password-help`} className="field-help">
                  {t("authPasswordHint")}
                </p>
                <label htmlFor={`${id}-confirmation`}>{t("authConfirmPassword")}</label>
                <input
                  id={`${id}-confirmation`}
                  name="password-confirmation"
                  type={visible ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => {
                    setConfirmation(event.target.value);
                    setMismatch(false);
                  }}
                  required
                  minLength={6}
                  maxLength={256}
                  aria-invalid={mismatch}
                  aria-describedby={mismatch ? `${id}-error` : undefined}
                />
              </>
            )}
            {setRemember && (
              <div className="remember-choice">
                <label>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                    aria-describedby={`${id}-remember-help`}
                  />
                  {t("authRemember")}
                </label>
                <p id={`${id}-remember-help`} className="field-help">
                  {t("authRememberHint")}
                </p>
              </div>
            )}
          </fieldset>
          {message && (
            <p id={`${id}-error`} role="alert" className="form-error">
              {message}
            </p>
          )}
          <button type="submit" disabled={busy} className="studio-primary auth-submit">
            {t(busy ? "authSubmitting" : mode === "login" ? "authLogin" : "authCreateAccount")}
          </button>
        </form>
        {onContinue && (
          <button type="button" disabled={busy} className="auth-guest" onClick={onContinue}>
            {t("continueEditing")} <span aria-hidden="true">↗</span>
          </button>
        )}
      </section>
    </main>
  );
}
