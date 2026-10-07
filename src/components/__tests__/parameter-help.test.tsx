import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { LOCALES, translations } from "../../i18n";
import { PARAM_BOUNDS, PARAMETER_FIELDS } from "../../domain/parameters";
import type { CalculatorInput } from "../../domain/stoveCalculator";
import { ParametersScreen } from "../ParametersScreen";

vi.mock("../StoveCalculator", () => ({ StoveCalculator: () => null }));

it.each(LOCALES)("associates each dimension with its localized help without duplicate IDs (%s)", (locale) => {
  const t = (key: keyof typeof translations.ru) => translations[locale][key];
  const screen = (
    <ParametersScreen
      locale={locale}
      calculatorInput={{} as CalculatorInput}
      onCalculatorChange={() => {}}
      onOpenReference={() => {}}
      parameters={{ foundationWidth: 100, foundationLength: 120, foundationThickness: 20, roomHeight: 250 }}
      updateParameter={() => {}}
      t={t}
      onContinue={() => {}}
      lockedRows={[]}
    />
  );
  const html = renderToStaticMarkup(
    <>
      {screen}
      {screen}
    </>
  );
  const inputs = html.match(/<input\b[^>]*>/g) ?? [];
  expect(inputs).toHaveLength(PARAMETER_FIELDS.length * 2);
  const ids = inputs.map((input, index) => {
    const bounds = PARAM_BOUNDS[PARAMETER_FIELDS[index % PARAMETER_FIELDS.length]];
    expect(input).toContain(`aria-label="${t(bounds.title)}, ${t("unitCm")}"`);
    const id = input.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(id).toBeDefined();
    const description = html.match(new RegExp(`<div id="${id}"[^>]*>([^<]*)</div>`))?.[1];
    expect(description).toBe(t(bounds.help));
    return id;
  });
  expect(new Set(ids).size).toBe(inputs.length);
});
