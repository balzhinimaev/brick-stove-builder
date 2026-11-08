import type { SyncIssue } from "../hooks/useSavedProjects";
import { LOCALES, type Locale, type Translate } from "../i18n";
import type { AutosaveState } from "../hooks/useAutosaveDraft";

export function Header({
  compact = false,
  locale,
  setLocale,
  t,
  reset,
  userLogin,
  onSwitchAccount,
  onSignIn,
  autosaveState,
  pendingCount,
  syncIssue,
  syncFailureStatus,
  sessionNotice
}: {
  compact?: boolean;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
  reset: () => void;
  placedCount: number;
  lockedCount: number;
  userLogin: string;
  onSwitchAccount: () => void;
  onSignIn: () => void;
  autosaveState: AutosaveState;
  pendingCount: number;
  syncIssue?: SyncIssue;
  syncFailureStatus?: number;
  sessionNotice?: string;
}) {
  const autosaveLabel =
    autosaveState === "saving"
      ? t("saving")
      : autosaveState === "saved"
        ? t("savedLocally")
        : autosaveState === "error"
          ? t("autosaveError")
          : "";
  return (
    <header className="studio-header">
      <div>
        <strong>{t("appTitle")}</strong>
        <output className="studio-save-state" aria-live="polite" aria-atomic="true">
          {autosaveLabel}
          {pendingCount > 0 ? ` · ${t("pendingSync")}: ${pendingCount}` : ""}
        </output>
        {sessionNotice && (
          <p role="alert" className="header-notice">
            {sessionNotice}
          </p>
        )}
        {syncIssue && (
          <p role="alert">
            {t(syncIssue)} {syncIssue === "syncRejected" && syncFailureStatus ? `(HTTP ${syncFailureStatus})` : ""}
          </p>
        )}
      </div>
      <div className="studio-header-actions">
        <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)} aria-label={t("language")}>
          {LOCALES.map((item) => (
            <option key={item} value={item}>
              {item.toUpperCase()}
            </option>
          ))}
        </select>
        {compact && (
          <button type="button" onClick={reset}>
            {t("reset")}
          </button>
        )}
        <button type="button" onClick={userLogin ? onSwitchAccount : onSignIn}>
          {userLogin ? `@${userLogin} • ${t("signOut")}` : t("authLogin")}
        </button>
      </div>
    </header>
  );
}
