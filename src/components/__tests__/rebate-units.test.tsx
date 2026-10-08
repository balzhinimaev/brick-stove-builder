import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { LOCALES, translations } from "../../i18n";
import { Toolbox } from "../builder/Toolbox";

it.each(LOCALES.flatMap((locale) => [20, 65].map((depth) => ({ locale, depth }))))(
  "localizes visible and announced rebate depth ($locale, $depth mm)",
  ({ locale, depth }) => {
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
        rebateDepthMm={depth}
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
    expect(html).toContain(`${depth} ${t("unitMm")}`);
    const ledge = depth === 65 ? t("cutterThrough") : `${t("cutterLedgeLeft")}: ${65 - depth} ${t("unitMm")}`;
    const slider = html.match(/<input[^>]*type="range"[^>]*>/)?.[0];
    expect(slider).toContain(`aria-valuetext="${depth} ${t("unitMm")}, ${ledge}"`);
    expect(html).toContain(ledge);
    expect(html).toContain(`${t("rebateDepthForPlate")}: 14 ${t("unitMm")}`);
  }
);
