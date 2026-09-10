import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { BRICK_BODY_HEIGHT, BRICK_LAYER_HEIGHT, DEFAULT_PARAMETERS, MM_PER_CELL } from "../../../domain/constants";
import { brickSolids, gridFromParameters } from "../../../domain/geometry";
import type { PlacedBrick } from "../../../domain/types";
import { fittedDistance, nudgePoint, placementPoint, PlacementGesture, solidBoxes } from "../sceneMath";

const grid = gridFromParameters(DEFAULT_PARAMETERS);
const brick: PlacedBrick = { id: "a", row: 3, x: 2, y: 3, kind: "standard", orientation: "h" };

describe("uniform physical scale", () => {
  it("renders a 65 mm body with a 5 mm course gap", () => {
    const box = solidBoxes(brick, grid)[0];
    expect(box.scale[1] * MM_PER_CELL).toBeCloseTo(65);
    expect((box.position[1] - box.scale[1] / 2) * MM_PER_CELL).toBeCloseTo(140);
    expect((BRICK_LAYER_HEIGHT - BRICK_BODY_HEIGHT) * MM_PER_CELL).toBeCloseTo(5);
  });
  it.each(["plate", "grate", "cleanout", "trim", "damper", "custom"] as const)(
    "matches collision solids for %s",
    (kind) => {
      const element = {
        ...brick,
        kind,
        custom: {
          name: "sample",
          w: 2,
          h: 1,
          notch: { x1: 1, y1: 0, x2: 2, y2: 0.5 },
          notchDepthMm: 20,
          heightMm: 210,
          thicknessMm: 14,
          seatZMm: 51,
          flush: true
        }
      };
      const solids = brickSolids(element);
      const rendered = solidBoxes(element, grid, 0);
      expect(rendered).toHaveLength(solids.length);
      rendered.forEach((box, index) => {
        expect(box.scale[1] * MM_PER_CELL).toBeCloseTo(solids[index].z2 - solids[index].z1);
        expect((box.position[1] - box.scale[1] / 2) * MM_PER_CELL).toBeCloseTo(140 + solids[index].z1);
      });
    }
  );
  it("preserves both orientations and a custom through-cut", () => {
    const cut: PlacedBrick = {
      ...brick,
      kind: "custom",
      custom: { name: "L", w: 2, h: 1, notch: { x1: 1, y1: 0, x2: 2, y2: 0.5 }, notchDepthMm: 65, ledge: false }
    };
    for (const orientation of ["h", "v"] as const) {
      const boxes = solidBoxes({ ...cut, orientation }, grid, 0);
      expect(boxes).toHaveLength(2);
      const volume = boxes.reduce((total, box) => total + box.scale[0] * box.scale[1] * box.scale[2], 0);
      expect(volume).toBeCloseTo(1.5 * BRICK_BODY_HEIGHT);
    }
  });
});

describe("placement coordinates", () => {
  it("snaps on the fixed model axes with precise half steps", () => {
    const point = placementPoint(-3.6, -3.3, grid, 0.5);
    if (!point) throw new Error("Expected an in-bounds placement");
    expect(point.x).toBe(1);
    expect(point.y).toBe(3);
    const next = nudgePoint(point, 0.5, -0.5);
    expect(next.x).toBe(1.5);
    expect(next.y).toBe(2.5);
    expect(next.rawX - point.rawX).toBeCloseTo(0.5);
  });
  it("does not turn an outside tap into a valid edge placement", () => {
    expect(placementPoint(-grid.cols / 2 - 0.01, 0, grid, 1)).toBeNull();
    expect(placementPoint(grid.cols / 2, 0, grid, 1)).toBeNull();
    expect(placementPoint(0, grid.rows / 2, grid, 1)).toBeNull();
  });
});

describe("camera fit", () => {
  it.each([0.45, 0.75, 1.8, 2.8])("keeps a tall model in frame at aspect %s", (aspect) => {
    const width = 10,
      depth = 13,
      height = 30;
    const distance = fittedDistance(width, depth, height, aspect, 38);
    for (const direction of [new Vector3(1, 0.85, 1), new Vector3(0, 1, 0.025), new Vector3(0, 0.05, 1)]) {
      const camera = new PerspectiveCamera(38, aspect, 0.05, 1000);
      camera.position.copy(direction.normalize().multiplyScalar(distance));
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      for (const x of [-width / 2, width / 2])
        for (const y of [-height / 2, height / 2])
          for (const z of [-depth / 2, depth / 2]) {
            const corner = new Vector3(x, y, z).project(camera);
            expect(Math.abs(corner.x)).toBeLessThan(1);
            expect(Math.abs(corner.y)).toBeLessThan(1);
          }
    }
  });
});

describe("touch gestures", () => {
  it("accepts one short tap", () => {
    const g = new PlacementGesture();
    g.down(1, 10, 20);
    expect(g.up(1, 12, 21)).toBe(true);
  });
  it("rejects a drag even when it returns to its origin", () => {
    const g = new PlacementGesture();
    g.down(1, 0, 0);
    g.move(40, 0);
    expect(g.up(1, 0, 0)).toBe(false);
  });
  it("rejects both releases of a pinch", () => {
    const g = new PlacementGesture();
    g.down(1, 0, 0);
    g.down(2, 10, 0);
    expect(g.up(2, 10, 0)).toBe(false);
    expect(g.up(1, 0, 0)).toBe(false);
    g.down(3, 0, 0);
    expect(g.up(3, 0, 0)).toBe(true);
  });
  it("rejects pointer cancellation and releases without a press", () => {
    const g = new PlacementGesture();
    g.down(1, 0, 0);
    g.cancel();
    expect(g.up(1, 0, 0)).toBe(false);
    expect(g.up(99, 0, 0)).toBe(false);
  });
});
