import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MaterialsSummary } from "../components/MaterialsSummary";
import type { MaterialsEstimate } from "../domain/types";
import { LOCALES, translations } from "../i18n";

const materials: MaterialsEstimate = {
  regularBricks: 11,
  cutBricks: 2,
  rebatedBricks: 3,
  firebricks: 4,
  grates: 1,
  plates: 1,
  doors: 2,
  dampers: 1,
  vents: 2,
  mortarM3: null,
  concreteVolumeM3: 0.25,
  total: 27
};

describe("materials summary language", () => {
  it.each(LOCALES)("renders inventory labels and purchasing caveats in %s", (locale) => {
    const dictionary = translations[locale];
    const html = renderToStaticMarkup(<MaterialsSummary materials={materials} t={(key) => dictionary[key]} />);
    for (const key of [
      "materialsInventoryHint",
      "materialsWholePieces",
      "materialsStraightCuts",
      "materialsShapedPieces",
      "materialsFireclaySubset",
      "materialsSlabConcrete",
      "materialsPurchasingHint"
    ] as const) {
      expect(html).toContain(dictionary[key]);
      if (locale !== "ru") expect(html).not.toContain(translations.ru[key]);
    }
    expect(html).toContain('class="font-black">11</dd>');
  });
});
