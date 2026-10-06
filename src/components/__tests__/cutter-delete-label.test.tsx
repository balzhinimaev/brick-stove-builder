import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { LOCALES, translations } from "../../i18n";
import { Toolbox } from "../builder/Toolbox";

it.each(LOCALES)("identifies cut-brick deletion without calling it project deletion (%s)", (locale) => {
  const t = (key: keyof typeof translations.ru) => translations[locale][key];
  const spec = { name: "Blank", w: 2, h: 1 };
  const noop = () => {};
  const props: ComponentProps<typeof Toolbox> = {
    t,
    activeTool: "standard",
    setActiveTool: noop,
    orientation: "h",
    setOrientation: noop,
    notchCorner: "ne",
    setNotchCorner: noop,
    rebateDepthMm: 35,
    setRebateDepth: noop,
    plateThicknessMm: 10,
    snapStep: 1,
    setSnapStep: noop,
    customBricks: [
      { id: "a", spec: { ...spec, name: "Shelf A" } },
      { id: "b", spec: { ...spec, name: "Shelf B" } }
    ],
    activeCustom: null,
    onPickCustom: noop,
    onRemoveCustom: noop,
    onOpenCutter: noop,
    plateSpec: spec,
    setPlateSize: noop,
    doorSpec: spec,
    setDoorSize: noop,
    damperSpec: spec,
    setDamperSize: noop,
    grateSpec: spec,
    setGrateSize: noop
  };
  const html = renderToStaticMarkup(<Toolbox {...props} />);
  for (const { spec: brick } of props.customBricks) {
    expect(html).toContain(`aria-label="${t("cutterRemove")}: ${brick.name}"`);
  }
  expect(html).not.toContain(`aria-label="${t("deleteProject")}`);
});
