import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import type { PlacedBrick } from "../../domain/types";
import { LOCALES, useI18n } from "../../i18n";
import { PrintOrder } from "../PrintOrder";

vi.mock("react-dom", () => ({ createPortal: (children: ReactNode) => children }));
vi.mock("../MaterialsSummary", () => ({ MaterialsSummary: () => null }));
afterEach(() => vi.unstubAllGlobals());

it.each(LOCALES)("prints table headings, units and shape descriptions in %s", (locale) => {
  vi.stubGlobal("document", { body: {} });
  const t = useI18n(locale);
  const base: PlacedBrick = { id: "straight", row: 1, kind: "standard", orientation: "h", x: 0, y: 0 };
  const rows = {
    1: [
      base,
      {
        ...base,
        id: "profile",
        x: 3,
        kind: "custom" as const,
        custom: {
          name: "Custom <name>",
          w: 1,
          h: 1,
          profileXZ: [
            { x: 0, z: 0 },
            { x: 125, z: 0 },
            { x: 0, z: 65 }
          ]
        }
      },
      {
        ...base,
        id: "composite",
        x: 5,
        kind: "custom" as const,
        custom: {
          name: "Composite",
          w: 1,
          h: 0.96,
          solidParts: [{ x1: 0, y1: 0, z1: 0, x2: 125, y2: 120, z2: 65 }]
        }
      }
    ]
  };
  const before = JSON.stringify(rows);
  const html = renderToStaticMarkup(
    <PrintOrder
      t={t}
      grid={{ cols: 10, rows: 10, widthCm: 125, lengthCm: 125 }}
      rows={rows}
      rowCount={1}
      lockedRows={[]}
      parameters={{ foundationWidth: 125, foundationLength: 125, foundationThickness: 20, roomHeight: 250 }}
      materials={{ total: 3 } as Parameters<typeof PrintOrder>[0]["materials"]}
    />
  );
  const table = html.slice(html.indexOf("<table>"), html.indexOf("</table>") + 8);
  for (const key of [
    "printPart",
    "printShape",
    "printCompositeShape",
    "printProfileShape",
    "printStraightShape"
  ] as const) {
    expect(table).toContain(t(key));
  }
  expect(table).toContain(`<th>X × Y × Z, ${t("unitMm")}</th>`);
  expect(table).toContain("Custom &lt;name&gt;");
  expect(table).toContain("250.0 × 125.0 × 65.0");
  expect(JSON.stringify(rows)).toBe(before);
});
