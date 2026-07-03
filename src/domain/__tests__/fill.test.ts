import { describe, expect, it } from "vitest";
import { brickBounds, fillRowBricks, gridFromParameters, overlaps } from "../geometry";
import { DEFAULT_PARAMETERS } from "../constants";
import type { PlacedBrick } from "../types";

const grid = gridFromParameters(DEFAULT_PARAMETERS);
let seq = 0;
const nextId = () => ++seq;

describe("fillRowBricks", () => {
  it("fills an empty row completely without overlaps or overflow", () => {
    const drafts = fillRowBricks([], grid, 1, "h", nextId);
    expect(drafts.length).toBeGreaterThan(0);
    const cells = drafts.reduce((sum, brick) => {
      const b = brickBounds(brick);
      return sum + (b.x2 - b.x1) * (b.y2 - b.y1);
    }, 0);
    expect(cells).toBe(grid.cols * grid.rows); // every cell covered
    for (let i = 0; i < drafts.length; i++) {
      const b = brickBounds(drafts[i]);
      expect(b.x2).toBeLessThanOrEqual(grid.cols);
      expect(b.y2).toBeLessThanOrEqual(grid.rows);
      for (let j = i + 1; j < drafts.length; j++) expect(overlaps(drafts[i], drafts[j])).toBe(false);
    }
  });

  it("respects existing bricks and plugs odd gaps with cut halves", () => {
    const existing: PlacedBrick[] = [{ id: "e1", row: 1, x: 1, y: 0, kind: "vent", orientation: "v" }];
    const drafts = fillRowBricks(existing, grid, 1, "h", nextId);
    for (const draft of drafts) expect(overlaps(draft, existing[0])).toBe(false);
    expect(drafts.some((brick) => brick.kind === "cut")).toBe(true);
  });

  it("returns nothing when the row is already full", () => {
    const full = fillRowBricks([], grid, 1, "h", nextId);
    expect(fillRowBricks(full, grid, 1, "h", nextId)).toHaveLength(0);
  });
});

describe("snapToStep", () => {
  it("snaps down to the step and clamps inside the grid", async () => {
    const { snapToStep } = await import("../geometry");
    expect(snapToStep(3.7, 1, 10)).toBe(3);
    expect(snapToStep(3.7, 0.5, 10)).toBe(3.5);
    expect(snapToStep(3.2, 0.5, 10)).toBe(3);
    expect(snapToStep(-1, 0.5, 10)).toBe(0);
    expect(snapToStep(10, 1, 10)).toBe(9);      // клик на краю не выпадает из сетки
    expect(snapToStep(9.99, 0.5, 10)).toBe(9.5);
  });
});
