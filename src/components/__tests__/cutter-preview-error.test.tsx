import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { translations } from "../../i18n";
import { BrickCutter } from "../BrickCutter";

const preview = vi.hoisted(() => ({ failed: false }));
vi.mock("react-dom", () => ({ createPortal: (children: ReactNode) => children }));
vi.mock("../ErrorBoundary", async (importOriginal) => {
  const { ErrorBoundary } = await importOriginal<typeof import("../ErrorBoundary")>();
  return {
    ErrorBoundary: class extends ErrorBoundary {
      // SSR does not catch render errors. Exercise the real boundary's error state
      // without mounting a browser or creating a WebGL context.
      state = preview.failed ? ErrorBoundary.getDerivedStateFromError() : { hasError: false };
    }
  };
});
afterEach(() => {
  preview.failed = false;
  vi.unstubAllGlobals();
});

it.each(["ru", "en", "lt"] as const)("keeps cutter controls available after preview failure (%s)", (locale) => {
  vi.stubGlobal("document", { body: {} });
  preview.failed = true;
  const t = (key: keyof typeof translations.ru) => translations[locale][key];
  const html = renderToStaticMarkup(<BrickCutter t={t} onSave={() => {}} onClose={() => {}} />);
  expect(html).toMatch(new RegExp(`<[^>]+role="alert"[^>]*>${t("sceneError")}</`));
  expect(html).not.toContain(t("loadingScene"));
  expect(html).toContain('id="cutter-length"');
  expect(html).toContain('id="cutter-width"');
  expect(html).toContain(`>${t("cutterSave")}</button>`);
  expect(html).toContain(`aria-label="${t("cancel")}"`);
  expect(html).toContain(`>${t("cancel")}</button>`);
});
