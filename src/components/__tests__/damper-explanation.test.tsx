import { BrickHighlight } from "../three/ThreeBrick";
import { damperBladeDetails, damperName } from "../damperDetails";
import { damperParts } from "../../domain/geometry";
import { ExactSection } from "../ExactSection";
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

describe("canonical saved blade details", () => {
  for (const orientation of ["h", "v"] as const) {
    for (const plane of ["vertical", "horizontal"] as const) {
      it.each([0, 0.37, 1])(`${plane}/${orientation} derives actual seat/frame heights at %s`, (damperOpen) => {
        const saved: PlacedBrick = {
          ...brick,
          orientation,
          damperOpen,
          custom: {
            ...brick.custom,
            damperPlane: plane,
            seatZMm: 23.5,
            damperFrameMm: 12,
            thicknessMm: 9,
            h: plane === "horizontal" ? 1.2 : 0.04,
            damperSlide: plane === "horizontal" ? "x-positive" : "x-negative"
          }
        };
        const before = JSON.stringify(saved);
        const solid = damperParts(saved).find((p) => p.role === "blade")!.solid;
        const detail = damperBladeDetails(saved);
        expect(detail.bottom).toBe(1120 + solid.z1);
        expect(detail.top).toBe(1120 + solid.z2);
        expect(JSON.stringify(saved)).toBe(before);
      });
    }
  }
  it("excludes course 31 at the exact 2100mm top and reads changed saved rows", () => {
    const saved: PlacedBrick = {
      ...brick,
      row: 23,
      damperOpen: 1,
      custom: { ...brick.custom, heightMm: 280, damperFrameMm: 0, seatZMm: 0 }
    };
    expect(damperBladeDetails(saved)).toEqual({ bottom: 1820, top: 2100, firstRow: 27, lastRow: 30 });
    expect(damperBladeDetails({ ...saved, row: 24 }).lastRow).toBe(31);
  });
  for (const locale of LOCALES) {
    it(`${locale} names only known unrenamed gates and shares naming with exact section`, () => {
      const t = translate(locale);
      const known: PlacedBrick = {
        ...brick,
        id: "rp54-upper-loop-gate",
        damperOpen: 0,
        custom: { ...brick.custom, name: "upper-loop-gate", damperFrameMm: 0 }
      };
      expect(damperName(known, t)).toBe(t("damperUpperLoop"));
      expect(damperName({ ...known, custom: { ...known.custom!, name: "My gate" } }, t)).toBe(
        `${t("damper")} · My gate`
      );
      expect(damperName({ ...known, id: "renamed-id" }, t)).not.toBe(t("damperUpperLoop"));
      const detail = renderToStaticMarkup(<DamperExplanation brick={known} t={t} />);
      expect(detail).toContain(t("damperUpperLoop"));
      expect(detail).toContain(t("damperBladeHeight"));
      const section = renderToStaticMarkup(
        <ExactSection bricks={[known]} grid={{ cols: 20, rows: 20, widthCm: 250, lengthCm: 250 }} row={17} t={t} />
      );
      expect(section).toContain(t("damperUpperLoop"));
    });
  }
});

it("closed-position schematic is selected-only, wireframe and non-pickable", () => {
  const props = { brick, grid: { cols: 20, rows: 20, widthCm: 250, lengthCm: 250 }, color: "cyan" };
  const ordinary = BrickHighlight(props);
  expect(ordinary.props.children[0]).toBe(false);
  const selected = BrickHighlight({ ...props, selected: true });
  const outline = selected.props.children[0][0];
  expect(outline.props.raycast()).toBe(null);
  const material = outline.props.children[1];
  expect(material.props.wireframe).toBe(true);
  expect(material.props.depthWrite).toBe(false);
});
