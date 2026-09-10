import { BufferGeometry, Float32BufferAttribute } from "three";
import { MM_PER_CELL } from "../../domain/constants";
import {
  brickSolids,
  COURSE_MM,
  polyhedronFaces,
  solidPolyhedron,
  type ConvexPolyhedron,
  type Point3Mm
} from "../../domain/geometry";
import type { GridSpec, PlacedBrick } from "../../domain/types";

/** Flat-shaded, outward-wound triangles from the EXACT canonical collision solid. */
export function polyhedronSceneGeometry(shape: ConvexPolyhedron, grid: GridSpec): BufferGeometry {
  const positions: number[] = [];
  const toWorld = (p: Point3Mm) => [
    p.x / MM_PER_CELL - grid.cols / 2,
    p.z / MM_PER_CELL,
    p.y / MM_PER_CELL - grid.rows / 2
  ];
  for (const { vertices, normal } of polyhedronFaces(shape)) {
    const a = vertices[0];
    for (let i = 1; i < vertices.length - 1; i++) {
      const b = vertices[i];
      const c = vertices[i + 1];
      const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
      const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
      const winding =
        (ab.y * ac.z - ab.z * ac.y) * normal.x +
        (ab.z * ac.x - ab.x * ac.z) * normal.y +
        (ab.x * ac.y - ab.y * ac.x) * normal.z;
      // Mapping document XYZ to Three XZY reverses handedness.
      for (const p of winding > 0 ? [a, c, b] : [a, b, c]) positions.push(...toWorld(p));
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function profileSceneGeometry(brick: PlacedBrick, grid: GridSpec): BufferGeometry {
  const solid = brickSolids(brick)[0];
  return polyhedronSceneGeometry(solidPolyhedron(solid, (brick.row - 1) * COURSE_MM), grid);
}
