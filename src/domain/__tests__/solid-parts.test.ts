import { expect, it } from "vitest";
import { solidPartsError } from "../../../shared/solidParts.js";
import { brickPhysicalSolids, planPlacement, pointInSolid } from "../geometry";
import { compoundSectionOutline } from "../masonrySections";
import { masonryCsv } from "../masonryAudit";
import type { PlacedBrick } from "../types";

const brick: PlacedBrick = {
  id: "cut-1",
  row: 1,
  kind: "custom",
  orientation: "h",
  x: 1,
  y: 1,
  custom: {
    name: "Corner cut",
    w: 2,
    h: 0.96,
    cutFrom: "standard",
    solidParts: [
      { x1: 0, y1: 0, z1: 0, x2: 120, y2: 120, z2: 65 },
      { x1: 120, y1: 0, z1: 0, x2: 250, y2: 60, z2: 65 }
    ]
  }
};
it("rejects disconnected, overlapping, oversized and conflicting compound shapes", () => {
  expect(solidPartsError(brick.custom)).toBeNull();
  for (const change of [{ x1: 125 }, { x1: 110 }, { x2: 260 }, { z2: 0 }, { y2: NaN }]) {
    const invalid = {
      ...brick.custom!,
      solidParts: [brick.custom!.solidParts![0], { ...brick.custom!.solidParts![1], ...change }]
    };
    expect(solidPartsError(invalid)).not.toBeNull();
    expect(
      planPlacement({}, 1, [{ ...brick, custom: invalid }], { cols: 20, rows: 20, widthCm: 250, lengthCm: 250 }).rows
    ).toBeNull();
  }
  for (const extra of [
    { heightMm: 65 },
    { notch: { x1: 0, x2: 1, y1: 0, y2: 1 } },
    { profileXZ: [] },
    { material: "steel" }
  ])
    expect(solidPartsError({ ...brick.custom, ...extra })).not.toBeNull();
});
it("rotates the occupied shape and its empty cutout together", () => {
  const solids = brickPhysicalSolids({ ...brick, orientation: "v" });
  expect(solids.some((s) => pointInSolid(s, { x: 125 + 30, y: 125 + 180, z: 30 }))).toBe(false);
  expect(solids.some((s) => pointInSolid(s, { x: 125 + 90, y: 125 + 180, z: 30 }))).toBe(true);
});
it("does not draw an invented seam inside a single L-shaped brick", () => {
  const polygon = (x1: number, y1: number, x2: number, y2: number) => [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 }
  ];
  const outline = compoundSectionOutline([polygon(0, 0, 120, 120), polygon(120, 0, 250, 60)]);
  expect(outline).not.toContain("M120,0L120,60");
  expect(outline).toContain("M120,60L120,120");
});
it("exports one schedule line per physical brick and escapes spreadsheet formulas", () => {
  const csv = masonryCsv([{ ...brick, custom: { ...brick.custom!, name: '=HYPERLINK("test")' } }]);
  expect(csv.trim().split("\r\n")).toHaveLength(2);
  expect(csv).toContain('"250";"120";"65"');
  expect(csv).toContain("'=HYPERLINK");
  expect(csv).toContain("Единый кирпич с вырезами");
});
