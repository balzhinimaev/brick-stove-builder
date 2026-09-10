import { describe, expect, it } from "vitest";
import { gridFromParameters, isInsideGrid, overlaps, overlaps3D } from "../geometry";
import { READY_PROJECTS } from "../projects";

describe("overlaps", () => {
  it("detects shared cells", () => {
    expect(
      overlaps({ x: 1, y: 1, kind: "standard", orientation: "h" }, { x: 2, y: 1, kind: "standard", orientation: "v" })
    ).toBe(true);
  });
  it("treats adjacent bricks as non-overlapping", () => {
    expect(
      overlaps({ x: 0, y: 0, kind: "cut", orientation: "h" }, { x: 1, y: 0, kind: "standard", orientation: "h" })
    ).toBe(false);
  });
});

describe("ready projects", () => {
  it("keeps every brick inside its foundation grid and without 3D placement overlap", () => {
    for (const project of READY_PROJECTS) {
      const grid = gridFromParameters(project.parameters);
      for (const rowBricks of Object.values(project.rows)) {
        for (const item of rowBricks) expect(isInsideGrid(item, grid)).toBe(true);
        for (const [index, item] of rowBricks.entries()) {
          for (const next of rowBricks.slice(index + 1)) expect(overlaps3D(item, next)).toBe(false);
        }
      }
    }
  });
});
