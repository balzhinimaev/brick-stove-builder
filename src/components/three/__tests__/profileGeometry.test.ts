import { describe, expect, it } from "vitest";
import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { profileSceneGeometry } from "../profileGeometry";
import { solidBoxes, solidSceneBox } from "../sceneMath";
import { brickPhysicalSolids } from "../../../domain/geometry";
import type { PlacedBrick } from "../../../domain/types";
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

describe("convex render, selection and bounds", () => {
  it("raycasts actual outward-wound faces, not empty AABB space", () => {
    const geometry = profileSceneGeometry(wedge, grid);
    const material = new MeshBasicMaterial();
    const mesh = new Mesh(geometry, material);
    mesh.updateMatrixWorld();
    const throughFront = (heightMm: number) =>
      new Raycaster(new Vector3(230 / 125 - 2, heightMm / 125, -3), new Vector3(0, 0, 1)).intersectObject(mesh);
    expect(throughFront(10)).toHaveLength(0);
    expect(throughFront(160)).toHaveLength(1);
    expect(geometry.boundingBox!.max.y * 125).toBeCloseTo(215, 4);
    expect(geometry.getAttribute("position").count).toBe(36);
    geometry.dispose();
    material.dispose();
  });
  it("triangulates non-quadrilateral profiles and rotated elevated bounds correctly", () => {
    const triangle = {
      ...wedge,
      row: 4,
      orientation: "v" as const,
      custom: {
        ...wedge.custom!,
        profileXZ: [
          { x: 0, z: 0 },
          { x: 250, z: 0 },
          { x: 125, z: 65 }
        ]
      }
    };
    const geometry = profileSceneGeometry(triangle, grid);
    expect(geometry.getAttribute("position").count).toBe(24);
    expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeCloseTo(1);
    expect(geometry.boundingBox!.max.z - geometry.boundingBox!.min.z).toBeCloseTo(2);
    expect(geometry.boundingBox!.min.y * 125).toBeCloseTo(210, 4);
    geometry.dispose();
  });
  it("fits the actually lifted vertical plate and renders its exact thin body", () => {
    const gate: PlacedBrick = {
      ...wedge,
      kind: "damper",
      row: 12,
      damperOpen: 1,
      custom: { name: "mouth", w: 430 / 125, h: 4 / 125, damperPlane: "vertical", heightMm: 280 }
    };
    const body = brickPhysicalSolids(gate)[0];
    const rendered = solidSceneBox(body, gate.row, grid);
    expect(rendered.scale[2] * 125).toBeCloseTo(4);
    expect((rendered.position[1] + rendered.scale[1] / 2) * 125).toBeCloseTo(11 * 70 + 560);
    expect(solidBoxes(gate, grid)).toEqual([rendered]);
  });
});
