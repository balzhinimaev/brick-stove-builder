import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { AutosaveState } from "../../hooks/useAutosaveDraft";
import { LOCALES, translations } from "../../i18n";
import { Header } from "../Header";

it.each(LOCALES)("keeps save feedback in an atomic live status in both headers (%s)", (locale) => {
  const t = (key: keyof typeof translations.ru) => translations[locale][key];
  for (const compact of [false, true]) {
    for (const state of ["idle", "saving", "saved", "error"] as AutosaveState[]) {
      const html = renderToStaticMarkup(
        <Header
          compact={compact}
          locale={locale}
          setLocale={() => {}}
          t={t}
          reset={() => {}}
          placedCount={12}
          lockedCount={2}
          userLogin=""
          onSwitchAccount={() => {}}
          onSignIn={() => {}}
          autosaveState={state}
          pendingCount={0}
        />
      );
      const status = html.match(/<output\b[^>]*>(.*?)<\/output>/s);
      expect(status).not.toBeNull();
      expect(status?.[0]).toContain('aria-live="polite"');
      expect(status?.[0]).toContain('aria-atomic="true"');
      const label =
        state === "saving"
          ? t("saving")
          : state === "saved"
            ? t("savedLocally")
            : state === "error"
              ? t("autosaveError")
              : "";
      expect(status?.[1].replace(/<[^>]*>/g, "")).toBe(label);
    }
  }
});

it.each(LOCALES)("announces pending sync counts in the save status of both headers (%s)", (locale) => {
  const t = (key: keyof typeof translations.ru) => translations[locale][key];
  for (const compact of [false, true]) {
    for (const pendingCount of [0, 1, 3]) {
      const html = renderToStaticMarkup(
        <Header
          compact={compact}
          locale={locale}
          setLocale={() => {}}
          t={t}
          reset={() => {}}
          placedCount={12}
          lockedCount={2}
          userLogin=""
          onSwitchAccount={() => {}}
          onSignIn={() => {}}
          autosaveState="saved"
          pendingCount={pendingCount}
        />
      );
      const status = html.match(/<output\b[^>]*>(.*?)<\/output>/s);
      expect(status?.[0]).toContain('aria-live="polite"');
      expect(status?.[0]).toContain('aria-atomic="true"');
      expect(status?.[1]).toContain(t("savedLocally"));
      if (pendingCount > 0) {
        expect(status?.[1]).toContain(`${t("pendingSync")}: ${pendingCount}`);
      } else {
        expect(status?.[1]).not.toContain(t("pendingSync"));
      }
    }
  }
});
