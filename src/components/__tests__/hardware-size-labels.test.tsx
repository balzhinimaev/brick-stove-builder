import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { LOCALES, translations } from "../../i18n";
import { DoorSizePanel } from "../builder/DoorSizePanel";
import { DamperSizePanel } from "../builder/DamperSizePanel";
import { GrateSizePanel } from "../builder/GrateSizePanel";
import { PlateSizePanel } from "../builder/PlateSizePanel";

it.each(LOCALES)("names every hardware dimension slider with its localized dimension and unit (%s)", (locale) => {
  const t = (key: keyof typeof translations.ru) => translations[locale][key];
  const spec = { name: "Hardware", w: 2, h: 2 };
  const cases = [
    { panel: <DoorSizePanel t={t} doorSpec={spec} setDoorSize={() => {}} />, keys: ["doorWidth", "doorHeight"] },
    {
      panel: <DamperSizePanel t={t} damperSpec={spec} setDamperSize={() => {}} />,
      keys: ["cutterLength", "cutterWidth"]
    },
    {
      panel: <GrateSizePanel t={t} grateSpec={spec} setGrateSize={() => {}} />,
      keys: ["cutterLength", "cutterWidth", "grateThickness"]
    },
    {
      panel: <PlateSizePanel t={t} plateSpec={spec} setPlateSize={() => {}} />,
      keys: ["cutterLength", "cutterWidth", "plateThickness"]
    }
  ] as const;
  for (const { panel, keys } of cases) {
    const sliders = renderToStaticMarkup(panel).match(/<input[^>]*type="range"[^>]*>/g) ?? [];
    expect(sliders).toHaveLength(keys.length);
    keys.forEach((key, index) => {
      expect(sliders[index]).toContain(`aria-label="${t(key)}"`);
    });
  }
});
