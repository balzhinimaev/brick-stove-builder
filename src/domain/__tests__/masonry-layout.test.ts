import { expect, it } from "vitest";
import { solidPartsError } from "../../../shared/solidParts.js";
import { brickPhysicalSolids, cloneRows, pointInSolid } from "../geometry";
import { HOUSE_RUSSIAN_STOVE, HOUSE_RUSSIAN_STOVE_R2 } from "../houseRussianStove";
import { auditMasonry } from "../masonryAudit";
import { stockSegments, uniteCutBricks } from "../masonryLayout";
import type { PlacedBrick } from "../types";

it("uses full bricks and practical closures with exact span and 5 mm joints", () => {
  expect(stockSegments(1000, 250).map((s) => s.length)).toEqual([250, 250, 250, 235]);
  for (const length of [5, 120, 250, 260, 510, 650, 1000, 1080, 1200, 2000])
    for (const stock of [120, 250])
      for (const reverse of [false, true]) {
        const segments = stockSegments(length, stock, reverse);
        expect(segments.at(-1)!.start + segments.at(-1)!.length).toBeCloseTo(length);
        expect(segments.every((s) => s.length > 0 && s.length <= stock)).toBe(true);
        for (let i = 1; i < segments.length; i++)
          expect(segments[i].start - segments[i - 1].start - segments[i - 1].length).toBeCloseTo(5);
        if (length >= 60) expect(Math.min(...segments.map((s) => s.length))).toBeGreaterThanOrEqual(25);
      }
});

const brick = (id: string, x: number, y: number, w: number, h: number): PlacedBrick => ({
  id,
  row: 1,
  x: x / 125,
  y: y / 125,
  kind: "custom",
  orientation: "h",
  custom: { name: "same stock", w: w / 125, h: h / 125, cutFrom: "standard" }
});
it("unites touching fragments, preserving a cutout and a single editable brick", () => {
  const input = [brick("a", 0, 0, 120, 120), brick("b", 120, 0, 130, 60)];
  const result = uniteCutBricks(input);
  expect(result).toHaveLength(1);
  expect(solidPartsError(result[0].custom)).toBeNull();
  expect(brickPhysicalSolids(result[0]).some((s) => pointInSolid(s, { x: 180, y: 90, z: 30 }))).toBe(false);
  expect(brickPhysicalSolids(result[0]).some((s) => pointInSolid(s, { x: 180, y: 30, z: 30 }))).toBe(true);
  const copy = cloneRows({ 1: result });
  copy[1][0].custom!.solidParts![0].x2 = 1;
  expect(result[0].custom!.solidParts![0].x2).not.toBe(1);
  expect(uniteCutBricks([input[0], brick("c", 125, 0, 125, 60)])).toHaveLength(2);
});

it("keeps R1 intact and materially reduces unnecessary R2 cuts", () => {
  const before = auditMasonry(Object.values(HOUSE_RUSSIAN_STOVE.rows).flat());
  const after = auditMasonry(Object.values(HOUSE_RUSSIAN_STOVE_R2.rows).flat());
  console.log(
    JSON.stringify({ R1: { ...before, issues: count(before.issues) }, R2: { ...after, issues: count(after.issues) } })
  );
  expect(before.full).toBe(19);
  expect(before.issues.filter((i) => i.kind === "thin")).toHaveLength(80);
  expect(after.full).toBeGreaterThan(before.full * 30);
  expect(after.total).toBeLessThan(before.total * 0.75);
  expect(after.issues.filter((i) => i.kind === "bond").length).toBeLessThan(
    before.issues.filter((i) => i.kind === "bond").length / 4
  );
  expect(after.issues.filter((i) => i.kind === "stock")).toHaveLength(0);
  expect(after.issues.filter((i) => i.kind === "thin").length).toBeLessThan(80);
  for (const b of Object.values(HOUSE_RUSSIAN_STOVE_R2.rows).flat()) expect(solidPartsError(b.custom), b.id).toBeNull();
});
function count(issues: ReturnType<typeof auditMasonry>["issues"]) {
  return Object.fromEntries(
    ["thin", "cut-detail", "stock", "bond"].map((kind) => [kind, issues.filter((i) => i.kind === kind).length])
  );
}
