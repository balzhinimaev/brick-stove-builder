import { describe, expect, it } from "vitest";
import {
  brickPrisms,
  cloneRows,
  convexOverlap,
  overlaps3D,
  pointInPrism,
  validProfile,
  cutBrickForPlate,
  brickSolids,
  planPlacement,
  brickPhysicalOverlap
} from "../geometry";
import { historyReducer, initialHistoryState } from "../editor/history";
import { DEFAULT_PARAMETERS } from "../constants";
import { estimateMaterials } from "../materials";
import type { PlacedBrick } from "../types";
const wedge: PlacedBrick = {
  id: "w",
  row: 1,
  x: 0,
  y: 0,
  kind: "custom",
  orientation: "h",
  custom: {
    name: "Voussoir",
    w: 2,
    h: 1,
    cutFrom: "firebrick",
    profileXZ: [
      { x: 0, z: 0 },
      { x: 250, z: 150 },
      { x: 250, z: 215 },
      { x: 0, z: 65 }
    ]
  }
};
const empty: PlacedBrick = {
  id: "empty",
  row: 1,
  x: 1.5,
  y: 0,
  kind: "custom",
  orientation: "h",
  custom: { name: "block", w: 0.5, h: 1 }
};

describe("vertical-profile engine integration", () => {
  it("makes the bounding solid explicitly convex and validates the same object API", () => {
    expect(validProfile(wedge.custom?.profileXZ, 250)).toBe(true);
    expect(validProfile(wedge.custom?.profileXZ, 200)).toBe(false);
    expect(brickSolids(wedge)[0].polyhedron).toBeDefined();
    expect(brickSolids(wedge)[0].z2).toBe(215);
  });
  it("does not collide with an empty region of an overlapping bounding box", () => {
    expect(overlaps3D(wedge, empty)).toBe(false);
    expect(overlaps3D(wedge, { ...empty, x: 0 })).toBe(true);
    expect(brickPhysicalOverlap(wedge, empty)).toBe(false);
  });
  it("rejects actual collisions across nonadjacent construction rows", () => {
    const upper = { ...empty, row: 3 };
    expect(overlaps3D(wedge, upper)).toBe(true);
    const grid = { cols: 8, rows: 8, widthCm: 100, lengthCm: 100 };
    const plan = planPlacement({ 1: [wedge] }, 3, [upper], grid);
    expect(plan.rows).toBeNull();
    expect(plan.conflicts).toEqual([wedge]);
    expect(planPlacement({ 1: [wedge] }, 1, [empty], grid).rows?.[1]).toHaveLength(2);
  });
  it("uses millimetres consistently under plan rotation and elevation", () => {
    const shape = brickPrisms({ ...wedge, row: 4, x: 2, y: 3, orientation: "v" })[0];
    expect(shape.min).toEqual([250, 375, 210]);
    expect(shape.max).toEqual([375, 625, 425]);
    expect(pointInPrism(shape, [300, 500, 310])).toBe(true);
    expect(pointInPrism(shape, [300, 600, 215])).toBe(false);
  });
  it("keeps touching faces separate", () => {
    const first = brickPrisms(wedge)[0],
      next = brickPrisms({ ...wedge, y: 1 })[0];
    expect(convexOverlap(first, next)).toBe(false);
    expect(convexOverlap(first, brickPrisms({ ...wedge, y: 0.99 })[0])).toBe(true);
  });
  it("roundtrips and deeply clones all profile vertices", () => {
    const original = JSON.parse(JSON.stringify({ 1: [wedge] }));
    const rows = cloneRows(original);
    expect(rows[1][0]).toEqual(wedge);
    rows[1][0].custom!.profileXZ![0].x = 20;
    expect(original[1][0].custom.profileXZ[0].x).toBe(0);
    expect(wedge.custom!.profileXZ![0].x).toBe(0);
  });
  it("refuses unrepresentable auto-seat cuts into a vertical profile", () => {
    expect(cutBrickForPlate(wedge, { ...empty, kind: "plate" }, 14)).toBeNull();
    const grid = { cols: 8, rows: 8, widthCm: 100, lengthCm: 100 };
    const bad = { ...wedge, custom: { ...wedge.custom!, notchDepthMm: 14 } };
    expect(planPlacement({}, 1, [bad], grid).rows).toBeNull();
  });
  it("counts each actual voussoir once, preserving its fireclay material", () => {
    const materials = estimateMaterials(
      [wedge, { ...wedge, id: "regular", custom: { ...wedge.custom!, cutFrom: "standard" } }],
      DEFAULT_PARAMETERS
    );
    expect(materials.firebricks).toBe(1);
    expect(materials.cutBricks).toBe(1);
    expect(materials.total).toBe(2);
  });
});

describe("profile editing history", () => {
  it("owns placed profile points independently of input/tool data through undo and redo", () => {
    const input: PlacedBrick = JSON.parse(JSON.stringify(wedge));
    const empty = initialHistoryState();
    empty.present = { ...empty.present, rows: {}, currentRow: 1, lockedRows: [] };
    let state = historyReducer(empty, { type: "place", bricks: [input] });
    input.custom!.profileXZ![0].x = 20;
    expect(state.present.rows[1][0].custom!.profileXZ![0].x).toBe(0);
    state = historyReducer(state, { type: "undo" });
    expect(state.present.rows[1] ?? []).toHaveLength(0);
    state = historyReducer(state, { type: "redo" });
    expect(state.present.rows[1][0].custom!.profileXZ![0].x).toBe(0);
    expect(brickSolids(state.present.rows[1][0])[0].polyhedron).toBeDefined();
  });
});
