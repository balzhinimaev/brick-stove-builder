import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMETERS } from "../constants";
import {
  brickSizeFor,
  brickWorldGeometry,
  gridFromParameters,
  isInsideGrid,
  overlaps,
  placeBrickInRow,
  removeBrickAt
} from "../geometry";
import { READY_PROJECTS } from "../projects";
import type { PlacedBrick } from "../types";

describe("brickSizeFor", () => {
  it("makes a horizontal standard brick span two cells wide", () => {
    expect(brickSizeFor("standard", "h").w).toBe(2);
  });
  it("makes a vertical standard brick span two cells tall", () => {
    expect(brickSizeFor("standard", "v").h).toBe(2);
  });
  it("treats cut and cleanout as one-cell footprints", () => {
    expect(brickSizeFor("cut", "h")).toEqual({ w: 1, h: 1 });
    expect(brickSizeFor("cleanout", "h")).toEqual({ w: 1, h: 1 });
  });
});

describe("gridFromParameters", () => {
  it("derives a 10×13 grid from the default 120×160 cm footprint", () => {
    const grid = gridFromParameters(DEFAULT_PARAMETERS);
    expect(grid.cols).toBe(10);
    expect(grid.rows).toBe(13);
  });
});

describe("isInsideGrid", () => {
  const grid = gridFromParameters(DEFAULT_PARAMETERS);
  it("accepts the last brick that still fits", () => {
    expect(isInsideGrid({ x: grid.cols - 2, y: grid.rows - 1, kind: "standard", orientation: "h" }, grid)).toBe(true);
  });
  it("rejects a brick that overflows the grid", () => {
    expect(isInsideGrid({ x: grid.cols - 1, y: grid.rows - 1, kind: "standard", orientation: "h" }, grid)).toBe(false);
  });
});

describe("overlaps", () => {
  it("detects shared cells", () => {
    expect(overlaps({ x: 1, y: 1, kind: "standard", orientation: "h" }, { x: 2, y: 1, kind: "standard", orientation: "v" })).toBe(true);
  });
  it("treats adjacent bricks as non-overlapping", () => {
    expect(overlaps({ x: 0, y: 0, kind: "cut", orientation: "h" }, { x: 1, y: 0, kind: "standard", orientation: "h" })).toBe(false);
  });
});

describe("placement", () => {
  const grid = gridFromParameters(DEFAULT_PARAMETERS);
  it("adds a valid brick to an empty row", () => {
    const brick: PlacedBrick = { id: "a", row: 1, x: 1, y: 1, kind: "standard", orientation: "h" };
    expect(placeBrickInRow([], brick, grid)).toHaveLength(1);
  });
  it("removes a brick covering the tapped cell", () => {
    const existing: PlacedBrick[] = [{ id: "a", row: 1, x: 1, y: 1, kind: "standard", orientation: "h" }];
    expect(removeBrickAt(existing, 2, 1)).toHaveLength(0);
  });
});

describe("brickWorldGeometry", () => {
  const grid = gridFromParameters(DEFAULT_PARAMETERS);
  it("aligns the 3D box center to the same grid coordinates as its footprint", () => {
    const g = brickWorldGeometry({ x: 1, y: 1, row: 2, kind: "standard", orientation: "h" }, grid);
    expect(g.position[0]).toBe(-3);
    expect(g.position[2]).toBe(-5);
  });
  it("renders a standard brick as a 2x1 box with a small mortar gap", () => {
    const g = brickWorldGeometry({ x: 1, y: 1, row: 2, kind: "standard", orientation: "h" }, grid);
    expect(g.scale[0]).toBeGreaterThan(1.9);
    expect(g.scale[2]).toBeGreaterThan(0.9);
  });
});

describe("ready projects", () => {
  it("keeps every brick inside its foundation grid and non-overlapping", () => {
    for (const project of READY_PROJECTS) {
      const grid = gridFromParameters(project.parameters);
      for (const rowBricks of Object.values(project.rows)) {
        for (const item of rowBricks) {
          expect(isInsideGrid(item, grid)).toBe(true);
        }
        rowBricks.forEach((item, index) => {
          rowBricks.slice(index + 1).forEach((next) => {
            expect(overlaps(item, next)).toBe(false);
          });
        });
      }
    }
  });
});
