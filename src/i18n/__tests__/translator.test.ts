import { expect, it } from "vitest";
import { LOCALES, translations, useI18n, type TranslationKey } from "../index";

it.each(LOCALES)("keeps the %s translator stable and preserves every translation", (locale) => {
  const translate = useI18n(locale);
  expect(useI18n(locale)).toBe(translate);
  for (const key of Object.keys(translations.ru) as TranslationKey[]) {
    expect(translate(key)).toBe(translations[locale][key] ?? translations.ru[key]);
  }
});

it("preserves translator identity through locale round trips", () => {
  const initial = useI18n("ru");
  const english = useI18n("en");
  expect(english).not.toBe(initial);
  expect(useI18n("ru")).toBe(initial);
});
