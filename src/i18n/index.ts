import { translations } from "./translations";
import type { Locale, TranslationKey } from "./translations";

export { translations };
export type { Locale, TranslationKey };

export const LOCALES: Locale[] = ["ru", "en", "lt"];

export type Translate = (key: TranslationKey) => string;

// Dictionaries are static: keep translator identity stable so consumers' memoized
// validation is not invalidated by unrelated editor updates.
const translators: Record<Locale, Translate> = {
  ru: createTranslator("ru"),
  en: createTranslator("en"),
  lt: createTranslator("lt")
};

function createTranslator(locale: Locale): Translate {
  return (key) => translations[locale][key] ?? translations.ru[key];
}

export function useI18n(locale: Locale): Translate {
  return translators[locale];
}
