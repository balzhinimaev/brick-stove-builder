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
  t
}: {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  login: string;
  setLogin: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  onSubmit: () => void;
  t: Translate;
}) {
  return (
    <section className="mt-3 rounded-[24px] border-2 border-[#3D2B1F]/15 bg-[#F5E6C8] p-4">
      <h2 className="text-lg font-black">{t("authTitle")}</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={() => setMode("login")} aria-pressed={mode === "login"} className={`min-h-11 rounded-2xl border ${mode === "login" ? "bg-[#3D2B1F] text-[#F5E6C8]" : "bg-[#FFF7E8]"}`}>{t("authLogin")}</button>
        <button onClick={() => setMode("register")} aria-pressed={mode === "register"} className={`min-h-11 rounded-2xl border ${mode === "register" ? "bg-[#3D2B1F] text-[#F5E6C8]" : "bg-[#FFF7E8]"}`}>{t("authRegister")}</button>
      </div>
      <form
        onSubmit={(event) => { event.preventDefault(); onSubmit(); }}
        className="mt-3 space-y-3"
      >
        <input
          value={login}
          onChange={(event) => setLogin(event.target.value)}
          placeholder={t("authLoginPlaceholder")}
          autoComplete="username"
          aria-label={t("authLoginPlaceholder")}
          className="min-h-12 w-full rounded-2xl border border-[#3D2B1F]/20 bg-[#FFF7E8] px-3"
        />
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={t("authPasswordPlaceholder")}
          type="password"
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          aria-label={t("authPasswordPlaceholder")}
          className="min-h-12 w-full rounded-2xl border border-[#3D2B1F]/20 bg-[#FFF7E8] px-3"
        />
        <button type="submit" className="min-h-12 w-full rounded-2xl bg-[#8FAF76] font-black">{mode === "login" ? t("authLogin") : t("authCreate")}</button>
      </form>
    </section>
  );
}
