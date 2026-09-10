import { Box3, BufferGeometry, Color, Float32BufferAttribute, Plane, Vector3 } from "three";
import { MM_PER_CELL } from "../../domain/constants";
import { brickPhysicalSolids, COURSE_MM, footprintSizeOf, solidPolyhedron } from "../../domain/geometry";
import type { GridSpec, PlacedBrick } from "../../domain/types";
import type { TeplushkaInspection } from "../builder/teplushkaInspection";
import { brickAppearance, isMasonry } from "./brickAppearance";
import { solidBoxes, solidSceneBox, type SceneBox } from "./sceneMath";

type SceneSolid = { vertices: Vector3[]; faces: number[][]; color: Color; brickId?: string };
const EPS = 1e-7;
const BOX_FACES = [
  [0, 3, 2, 1],
  [4, 5, 6, 7],
  [0, 1, 5, 4],
  [1, 2, 6, 5],
  [2, 3, 7, 6],
  [3, 0, 4, 7]
];

function boxSolid(box: SceneBox, color: Color): SceneSolid {
  const [x, y, z] = box.position;
  const [w, h, d] = box.scale.map((value) => value / 2);
  return {
    vertices: [y - h, y + h].flatMap((height) => [
      new Vector3(x - w, height, z - d),
      new Vector3(x + w, height, z - d),
      new Vector3(x + w, height, z + d),
      new Vector3(x - w, height, z + d)
    ]),
    faces: BOX_FACES,
    color
  };
}

function brickSceneSolids(brick: PlacedBrick, grid: GridSpec): SceneSolid[] {
  if (brick.kind === "vent") return [];
  const color = ["plate", "grate", "damper", "cleanout"].includes(brick.kind)
    ? new Color("#353a3c")
    : brickAppearance(brick).color;
  if (brick.kind === "cleanout") {
    const box = solidBoxes(brick, grid, 0.025)[0];
    const size = footprintSizeOf(brick);
    const width = Math.max(size.w, size.h) - 0.04;
    const depth = Math.min(size.w, size.h) * 0.26;
    return [
      boxSolid({ ...box, scale: size.w >= size.h ? [width, box.scale[1], depth] : [depth, box.scale[1], width] }, color)
    ];
  }
  if (brick.custom?.profileXZ) {
    return brickPhysicalSolids(brick).map((solid) => {
      const shape = solidPolyhedron(solid, (brick.row - 1) * COURSE_MM);
      return {
        vertices: shape.vertices.map(
          (p) => new Vector3(p.x / MM_PER_CELL - grid.cols / 2, p.z / MM_PER_CELL, p.y / MM_PER_CELL - grid.rows / 2)
        ),
        faces: shape.faces,
        color
      };
    });
  }
  const masonry = isMasonry(brick);
  const boxes = masonry
    ? solidBoxes(brick, grid)
    : brickPhysicalSolids(brick).map((solid) => solidSceneBox(solid, brick.row, grid));
  const solids = boxes.map((box) => boxSolid(box, color));
  // Match the existing rendered bed joints; no joint is invented through a wedge or through-cut.
  if (masonry && brick.row > 1) {
    for (const box of solidBoxes(brick, grid, 0.008)) {
      const bottom = box.position[1] - box.scale[1] / 2;
      if (Math.abs(bottom - ((brick.row - 1) * COURSE_MM) / MM_PER_CELL) > 0.001) continue;
      solids.push(
        boxSolid(
          {
            position: [box.position[0], bottom - 2.5 / MM_PER_CELL, box.position[2]],
            scale: [box.scale[0], 5 / MM_PER_CELL, box.scale[2]]
          },
          new Color("#a59b88")
        )
      );
    }
  }
  return solids;
}

/** The document-wide plane stays fixed while stepping through source courses. */
export function inspectionPlane(
  inspection: TeplushkaInspection | undefined,
  bricks: PlacedBrick[],
  grid: GridSpec
): Plane | null {
  if (!inspection || inspection.section === "whole") return null;
  const boxes = bricks.filter(isMasonry).flatMap((brick) => solidBoxes(brick, grid));
  if (!boxes.length) return null;
  const axis = inspection.section === "front" ? 2 : 0;
  const min = Math.min(...boxes.map((box) => box.position[axis] - box.scale[axis] / 2));
  const max = Math.max(...boxes.map((box) => box.position[axis] + box.scale[axis] / 2));
  const fraction = Math.max(0.05, Math.min(0.95, inspection.fraction));
  return new Plane(axis === 2 ? new Vector3(0, 0, 1) : new Vector3(1, 0, 0), -(min + (max - min) * fraction));
}

/** Close only occupied cross-sections. Convex wedges use their true edges, never their bounding box. */
export function sectionScene(bricks: PlacedBrick[], grid: GridSpec, plane: Plane, foundationHeight = 0) {
  const solids: SceneSolid[] = bricks.flatMap((brick) =>
    brickSceneSolids(brick, grid).map((solid) => ({ ...solid, brickId: brick.id }))
  );
  if (foundationHeight > 0)
    solids.push(
      boxSolid(
        {
          position: [0, -foundationHeight / 2, 0],
          scale: [grid.cols + 0.25, foundationHeight, grid.rows + 0.25]
        },
        new Color("#bcbeb5")
      )
    );
  const bounds = new Box3();
  const retainedBrickIds = new Set<string>();
  const positions: number[] = [];
  const colors: number[] = [];
  const outward = plane.normal.clone().negate();
  const u = new Vector3(0, 1, 0);
  const v = outward.clone().cross(u);
  for (const solid of solids) {
    const distances = solid.vertices.map((point) => plane.distanceToPoint(point));
    if (Math.max(...distances) <= EPS) continue;
    if (solid.brickId) retainedBrickIds.add(solid.brickId);
    solid.vertices.forEach((point, index) => {
      if (distances[index] >= -EPS) bounds.expandByPoint(point);
    });
    if (Math.min(...distances) >= -EPS || Math.max(...distances) <= EPS) continue;
    const intersections: Vector3[] = [];
    const add = (point: Vector3) => {
      if (!intersections.some((existing) => existing.distanceToSquared(point) < EPS * EPS)) intersections.push(point);
    };
    for (const face of solid.faces) {
      face.forEach((index, edge) => {
        const next = face[(edge + 1) % face.length];
        const a = solid.vertices[index],
          b = solid.vertices[next];
        const da = distances[index],
          db = distances[next];
        if (Math.abs(da) <= EPS) add(a.clone());
        if ((da < -EPS && db > EPS) || (da > EPS && db < -EPS)) add(a.clone().lerp(b, da / (da - db)));
      });
    }
    for (const point of intersections) bounds.expandByPoint(point);
    if (intersections.length < 3) continue;
    const center = intersections
      .reduce((sum, point) => sum.add(point), new Vector3())
      .divideScalar(intersections.length);
    intersections.sort((a, b) => {
      const aa = a.clone().sub(center),
        bb = b.clone().sub(center);
      return Math.atan2(aa.dot(v), aa.dot(u)) - Math.atan2(bb.dot(v), bb.dot(u));
    });
    for (let index = 1; index < intersections.length - 1; index++) {
      for (const point of [intersections[0], intersections[index], intersections[index + 1]]) {
        // A sub-pixel inset keeps the cap on the retained side of the GPU clipping plane.
        positions.push(...point.clone().addScaledVector(plane.normal, 0.00001).toArray());
        colors.push(solid.color.r, solid.color.g, solid.color.b);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return { geometry, bounds, retainedBrickIds };
}
