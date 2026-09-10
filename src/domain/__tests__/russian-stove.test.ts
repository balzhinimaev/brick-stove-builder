import { describe, expect, it } from "vitest";
import { RUSSIAN_STOVE } from "../russianStove";
import { gridFromParameters, isInsideGrid, overlaps3D, cloneRows } from "../geometry";

const bricks = Object.values(RUSSIAN_STOVE.rows).flat();
describe("Russian stove demonstration", () => {
  it("has 36 nonempty editable courses, unique IDs and fits its foundation", () => {
    expect(Object.keys(RUSSIAN_STOVE.rows)).toHaveLength(36);
    expect(RUSSIAN_STOVE.lockedRows).toEqual([]);
    expect(new Set(bricks.map((brick) => brick.id)).size).toBe(bricks.length);
    const grid = gridFromParameters(RUSSIAN_STOVE.parameters);
    for (let row = 1; row <= 36; row++) {
      expect(RUSSIAN_STOVE.rows[row].length).toBeGreaterThan(0);
      for (const brick of RUSSIAN_STOVE.rows[row]) {
        expect(brick.row).toBe(row);
        expect(isInsideGrid(brick, grid)).toBe(true);
      }
    }
  });
  it("has no occupied 3D intersections, including tall doors and seats", () => {
    const collisions: string[] = [];
    for (let a = 0; a < bricks.length; a++)
      for (let b = a + 1; b < bricks.length; b++) {
        if (Math.abs(bricks[a].row - bricks[b].row) > 4) continue;
        if (overlaps3D(bricks[a], bricks[b]))
          collisions.push(`${bricks[a].row}:${bricks[a].id} / ${bricks[b].row}:${bricks[b].id}`);
      }
    expect(collisions).toEqual([]);
  });
  it("keeps hardware and the chamber, mouth and chimney voids", () => {
    for (const kind of ["plate", "grate", "damper"]) expect(bricks.filter((b) => b.kind === kind)).toHaveLength(1);
    expect(bricks.filter((b) => b.kind === "cleanout")).toHaveLength(2);
    const point = (row: number, x: number, y: number) => ({
      id: "probe",
      row,
      x,
      y,
      kind: "cut" as const,
      orientation: "h" as const
    });
    for (let row = 13; row <= 20; row++) {
      expect(bricks.some((b) => overlaps3D(b, point(row, 6, 6)))).toBe(false);
      expect(bricks.some((b) => overlaps3D(b, point(row, 6, 11)))).toBe(false);
    }
    for (let row = 26; row <= 36; row++)
      if (row !== 29) {
        expect(bricks.some((b) => overlaps3D(b, point(row, 6, 12)))).toBe(false);
      }
  });
  it("clones without modifying the public template", () => {
    const rows = cloneRows(RUSSIAN_STOVE.rows);
    rows[1][0].x = 99;
    rows[12].find((b) => b.kind === "plate")!.custom!.w = 1;
    expect(RUSSIAN_STOVE.rows[1][0].x).not.toBe(99);
    expect(RUSSIAN_STOVE.rows[12].find((b) => b.kind === "plate")!.custom!.w).toBe(5);
  });
});
