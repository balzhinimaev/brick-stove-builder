import { describe, expect, it } from "vitest";
import { Mesh, MeshBasicMaterial, Plane, Raycaster, Vector3 } from "three";
import type { PlacedBrick } from "../../../domain/types";
import { sectionScene } from "../sectionGeometry";

const grid = { cols: 4, rows: 4, widthCm: 50, lengthCm: 50 };
const wedge: PlacedBrick = {
  id: "w",
  row: 1,
  x: 0,
  y: 0,
  kind: "custom",
  orientation: "h",
  custom: {
    name: "w",
    w: 2,
    h: 1,
    profileXZ: [
      { x: 0, z: 0 },
      { x: 250, z: 150 },
      { x: 250, z: 215 },
      { x: 0, z: 65 }
    ]
  }
};

describe("cutaway cross-sections", () => {
  it.each(["h", "v"] as const)("caps the real wedge, leaving empty bounding-box space open (%s)", (orientation) => {
    const front = orientation === "h";
    const normal = front ? new Vector3(0, 0, 1) : new Vector3(1, 0, 0);
    const { geometry } = sectionScene([{ ...wedge, orientation }], grid, new Plane(normal, 1.5));
    const material = new MeshBasicMaterial();
    const mesh = new Mesh(geometry, material);
    mesh.updateMatrixWorld();
    const hits = (heightMm: number) =>
      new Raycaster(
        front ? new Vector3(230 / 125 - 2, heightMm / 125, -3) : new Vector3(-3, heightMm / 125, 230 / 125 - 2),
        normal
      ).intersectObject(mesh);
    expect(hits(10)).toHaveLength(0);
    expect(hits(160)).toHaveLength(1);
    geometry.dispose();
    material.dispose();
  });

  it("does not cap a through-cut or fill a shallow rebate", () => {
    for (const ledge of [false, true]) {
      const brick: PlacedBrick = {
        ...wedge,
        custom: {
          name: "notched",
          w: 2,
          h: 1,
          notch: { x1: 1, y1: 0, x2: 2, y2: 0.5 },
          notchDepthMm: 30,
          ledge
        }
      };
      const { geometry } = sectionScene([brick], grid, new Plane(new Vector3(0, 0, 1), 1.75));
      const material = new MeshBasicMaterial();
      const mesh = new Mesh(geometry, material);
      mesh.updateMatrixWorld();
      const hits = (x: number, heightMm: number) =>
        new Raycaster(new Vector3(x - 2, heightMm / 125, -3), new Vector3(0, 0, 1)).intersectObject(mesh);
      expect(hits(0.5, 50)).toHaveLength(1);
      expect(hits(1.5, 50)).toHaveLength(0);
      expect(hits(1.5, 10)).toHaveLength(ledge ? 1 : 0);
      geometry.dispose();
      material.dispose();
    }
  });

  it("frames the retained chamber instead of the removed tall chimney, without changing the document", () => {
    const bricks: PlacedBrick[] = [
      { id: "chimney", row: 30, x: 0, y: 0, kind: "standard", orientation: "h" },
      { id: "chamber", row: 1, x: 0, y: 2, kind: "standard", orientation: "h" }
    ];
    const before = JSON.stringify(bricks);
    const { geometry, bounds, retainedBrickIds } = sectionScene(bricks, grid, new Plane(new Vector3(0, 0, 1), 0.5));
    expect(bounds.max.y * 125).toBeCloseTo(65);
    expect(bounds.min.z).toBeGreaterThanOrEqual(-0.5);
    expect([...retainedBrickIds]).toEqual(["chamber"]);
    expect(JSON.stringify(bricks)).toBe(before);
    geometry.dispose();
  });
});
