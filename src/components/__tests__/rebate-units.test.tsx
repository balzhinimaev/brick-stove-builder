import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { LOCALES, translations } from "../../i18n";
import { Toolbox } from "../builder/Toolbox";

it.each(LOCALES)("localizes rebate depth, remaining ledge and plate preset units (%s)", (locale) => {
  const t = (key: keyof typeof translations.ru) => translations[locale][key];
  const noop = () => {};
  const spec = { name: "Hardware", w: 2, h: 2 };
  const html = renderToStaticMarkup(
    <Toolbox
      t={t}
      activeTool="rebate"
      setActiveTool={noop}
      orientation="h"
      setOrientation={noop}
      notchCorner="nw"
      setNotchCorner={noop}
      rebateDepthMm={20}
      setRebateDepth={noop}
      plateThicknessMm={14}
      snapStep={1}
      setSnapStep={noop}
      customBricks={[]}
      activeCustom={null}
      onPickCustom={noop}
      onRemoveCustom={noop}
      onOpenCutter={noop}
      plateSpec={spec}
      setPlateSize={noop}
      doorSpec={spec}
      setDoorSize={noop}
      damperSpec={spec}
      setDamperSize={noop}
      grateSpec={spec}
      setGrateSize={noop}
    />
  );
  expect(html).toContain(`20 ${t("unitMm")}`);
  expect(html).toContain(`${t("cutterLedgeLeft")}: 45 ${t("unitMm")}`);
  expect(html).toContain(`${t("rebateDepthForPlate")}: 14 ${t("unitMm")}`);
});
