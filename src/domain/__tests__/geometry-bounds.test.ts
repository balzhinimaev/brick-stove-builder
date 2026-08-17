import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMETERS } from "../constants";
import { brickSizeFor, brickWorldGeometry, gridFromParameters, isInsideGrid } from "../geometry";

describe("brickSizeFor", () => {
  it("makes a horizontal standard brick span two cells wide", () => expect(brickSizeFor("standard", "h").w).toBe(2));
  it("makes a vertical standard brick span two cells tall", () => expect(brickSizeFor("standard", "v").h).toBe(2));
  it("treats cut and cleanout as one-cell footprints", () => {
    expect(brickSizeFor("cut", "h")).toEqual({ w: 1, h: 1 });
    expect(brickSizeFor("cleanout", "h")).toEqual({ w: 1, h: 1 });
  });
});

describe("grid bounds", () => {
  const grid = gridFromParameters(DEFAULT_PARAMETERS);
  it("derives a 10×13 grid from the default 120×160 cm footprint", () => {
    expect(grid.cols).toBe(10);
    expect(grid.rows).toBe(13);
  });
  it("accepts the last brick that still fits", () => {
    expect(isInsideGrid({ x: grid.cols - 2, y: grid.rows - 1, kind: "standard", orientation: "h" }, grid)).toBe(true);
  });
  it("rejects a brick that overflows the grid", () => {
    expect(isInsideGrid({ x: grid.cols - 1, y: grid.rows - 1, kind: "standard", orientation: "h" }, grid)).toBe(false);
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
