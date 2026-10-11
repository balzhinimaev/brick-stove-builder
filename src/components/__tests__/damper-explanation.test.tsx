import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PlacedBrick } from "../../domain/types";
import { translations, LOCALES, type Translate } from "../../i18n";
import { DamperExplanation } from "../DamperExplanation";

const translate =
  (locale: keyof typeof translations): Translate =>
  (key) =>
    translations[locale][key];
const brick = {
  id: "user-copy",
  kind: "damper",
  row: 17,
  x: 2,
  y: 3,
  orientation: "v",
  custom: { name: "saved", w: 2, h: 0.04, heightMm: 310, damperPlane: "vertical" }
} satisfies PlacedBrick;
describe("selected saved damper explanation", () => {
  for (const locale of LOCALES) {
    it.each([0, 0.42, 1])(`${locale}: explains installation, movement and state %s`, (damperOpen) => {
      const t = translate(locale);
      const html = renderToStaticMarkup(<DamperExplanation brick={{ ...brick, damperOpen }} t={t} />);
      expect(html).toContain(`${t("damperInstalledRow")} 17.`);
      expect(html).toContain(t(damperOpen === 0 ? "damperClosed" : damperOpen === 1 ? "damperOpen" : "damperPartial"));
      expect(html).toContain(`(${Math.round(damperOpen * 100)}%)`);
      expect(html).toContain(t("damperRaisedExplanation"));
      expect(html).toContain(t("damperSchematicExplanation"));
      if (locale !== "ru") expect(t("damperSchematicExplanation")).not.toBe(translations.ru.damperSchematicExplanation);
    });
    it(`${locale}: horizontal and sideways gates are not described as raised`, () => {
      for (const custom of [
        { name: "horizontal", w: 2, h: 1 },
        { ...brick.custom, damperSlide: "x-positive" as const }
      ]) {
        const html = renderToStaticMarkup(<DamperExplanation brick={{ ...brick, custom }} t={translate(locale)} />);
        expect(html).toContain(translations[locale].damperSlidingExplanation);
        expect(html).not.toContain(translations[locale].damperRaisedExplanation);
      }
    });
  }
  it("does not add damper text to other parts", () => {
    expect(
      renderToStaticMarkup(
        <DamperExplanation brick={{ ...brick, kind: "standard", custom: undefined }} t={translate("ru")} />
      )
    ).toBe("");
  });
});
