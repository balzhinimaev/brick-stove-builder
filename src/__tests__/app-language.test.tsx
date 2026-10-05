import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import App from "../App";
import { LOCALES, translations, type Locale, type TranslationKey } from "../i18n";

const state = vi.hoisted(() => ({ locale: "ru" as Locale }));
vi.mock("../hooks/useStudioState", () => ({
  useStudioState: () => ({
    locale: state.locale,
    t: (key: TranslationKey) => translations[state.locale][key],
    screen: "parameters",
    materials: { total: 0 },
    lockedRows: [],
    localWorkspace: { ready: false }
  })
}));
vi.mock("../components/BuilderScreen", () => ({ BuilderScreen: () => null }));

it("marks the app's language when switching locales, including back to Russian", () => {
  for (const locale of [...LOCALES, "ru"] as Locale[]) {
    state.locale = locale;
    const html = renderToStaticMarkup(<App />);
    expect(html.match(/^<div\b[^>]*>/)?.[0]).toContain(`lang="${locale}"`);
    expect(html).toContain(translations[locale].parametersTab);
  }
});
