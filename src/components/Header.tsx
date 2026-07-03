import { COLORS } from "../theme/colors";
import { LOCALES, type Locale, type Translate } from "../i18n";
import type { AutosaveState } from "../hooks/useAutosaveDraft";
import { Pill } from "./ui";

export function Header({
  locale,
  setLocale,
  t,
  reset,
  placedCount,
  lockedCount,
  userLogin,
  onSwitchAccount,
  autosaveState,
  pendingCount
}: {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
  reset: () => void;
  placedCount: number;
  lockedCount: number;
  userLogin: string;
  onSwitchAccount: () => void;
  autosaveState: AutosaveState;
  pendingCount: number;
}) {
  const autosaveLabel =
    autosaveState === "saving" ? t("saving")
    : autosaveState === "saved" ? t("savedLocally")
    : autosaveState === "error" ? t("autosaveError")
    : "";
  return (
    <header className="sticky top-2 z-20 rounded-[26px] border-2 border-[#3D2B1F]/15 bg-[#F5E6C8]/95 p-3 shadow-lg shadow-[#3D2B1F]/10 backdrop-blur">
      <div className="flex items-center gap-3">
        <StoveIcon />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-black uppercase tracking-wide text-[#5F7E4D]">{t("appTitle")}</div>
          <h1 className="truncate text-[20px] font-black leading-6 tracking-tight">{t("projectName")}</h1>
          <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none]">
            <Pill>{t("totalPlaced")}: {placedCount}</Pill>
            <Pill>{t("rowCompleted")}: {lockedCount}</Pill>
            <Pill>{t("brickSize")}</Pill>
            {userLogin && autosaveLabel ? <Pill>{autosaveLabel}</Pill> : null}
            {pendingCount > 0 ? <span className="shrink-0 rounded-full bg-[#9b2c2c]/15 px-2.5 py-1 text-[11px] font-extrabold text-[#9b2c2c]">⏳ {t("pendingSync")}: {pendingCount}</span> : null}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <button onClick={reset} className="min-h-11 rounded-full border border-[#3D2B1F]/25 px-3 text-xs font-black">{t("reset")}</button>
          {userLogin ? <button onClick={onSwitchAccount} className="min-h-9 rounded-full border border-[#3D2B1F]/25 px-3 text-[10px] font-black">@{userLogin} • {t("signOut")}</button> : null}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-[20px] border border-[#3D2B1F]/10 bg-[#FFF7E8]/70 p-1.5" role="group" aria-label={t("language")}>
        {LOCALES.map((item) => (
          <button
            key={item}
            onClick={() => setLocale(item)}
            aria-pressed={locale === item}
            className={`min-h-9 rounded-2xl px-2 text-xs font-black transition ${locale === item ? "bg-[#3D2B1F] text-[#F5E6C8]" : "bg-[#F5E6C8] text-[#3D2B1F]"}`}
          >
            {item.toUpperCase()}
          </button>
        ))}
      </div>
    </header>
  );
}

function StoveIcon() {
  return (
    <div className="grid h-[58px] w-[58px] shrink-0 place-items-center">
      <svg width="58" height="58" viewBox="0 0 74 74" aria-hidden="true">
        <circle cx="37" cy="37" r="34" fill={COLORS.cream} />
        <rect x="18" y="48" width="38" height="10" rx="3" fill={COLORS.foundation} stroke={COLORS.charcoal} strokeWidth="2" />
        <rect x="20" y="33" width="34" height="16" rx="5" fill={COLORS.brickRed} stroke={COLORS.charcoal} strokeWidth="2" />
        <rect x="24" y="18" width="26" height="15" rx="4" fill={COLORS.brickOrange} stroke={COLORS.charcoal} strokeWidth="2" />
        <rect x="31" y="25" width="12" height="17" rx="5" fill={COLORS.charcoal} />
        <path d="M33 42 C28 34, 42 32, 35 23 C48 32, 47 44, 37 50 C37 45, 34 45, 33 42Z" fill="#FFBF54" />
        <line x1="22" y1="41" x2="52" y2="41" stroke={COLORS.mortar} strokeWidth="2" />
        <line x1="31" y1="33" x2="31" y2="49" stroke={COLORS.mortar} strokeWidth="2" />
        <line x1="43" y1="33" x2="43" y2="49" stroke={COLORS.mortar} strokeWidth="2" />
      </svg>
    </div>
  );
}
