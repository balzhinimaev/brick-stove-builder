import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { LOCALES, translations } from "../../i18n";
import { BrickCutter } from "../BrickCutter";

vi.mock("react-dom", () => ({ createPortal: (children: ReactNode) => children }));
afterEach(() => vi.unstubAllGlobals());

it.each(LOCALES)("names all five cutter corner choices without relying on glyphs (%s)", (locale) => {
  vi.stubGlobal("document", { body: {} });
  const t = (key: keyof typeof translations.ru) => translations[locale][key];
  const html = renderToStaticMarkup(<BrickCutter t={t} onSave={() => {}} onClose={() => {}} />);
  const choices = html.match(/<button[^>]*aria-pressed="(?:true|false)"[^>]*>[\s\S]*?<\/button>/g) ?? [];
  expect(choices).toHaveLength(5);
  const names = [
    ["Без выреза", "Верхний левый угол", "Верхний правый угол", "Нижний левый угол", "Нижний правый угол"],
    ["No cut", "Top left corner", "Top right corner", "Bottom left corner", "Bottom right corner"],
    [
      "Be išpjovos",
      "Viršutinis kairysis kampas",
      "Viršutinis dešinysis kampas",
      "Apatinis kairysis kampas",
      "Apatinis dešinysis kampas"
    ]
  ][LOCALES.indexOf(locale)];
  choices.forEach((button, index) => {
    expect(button).toContain(`aria-label="${names[index]}"`);
    expect(button).toContain(`aria-pressed="${index === 2}"`);
  });
});
