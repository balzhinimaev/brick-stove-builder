import { translations } from "./translations";
import type { Locale, TranslationKey } from "./translations";

export { translations };
export type { Locale, TranslationKey };

export const LOCALES: Locale[] = ["ru", "en", "lt"];

export type Translate = (key: TranslationKey) => string;

export function useI18n(locale: Locale): Translate {
  return (key: TranslationKey): string => translations[locale][key] ?? translations.ru[key];
}
