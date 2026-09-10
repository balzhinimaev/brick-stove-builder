/** Tuple adapters for existing inspection tools. There is only one canonical geometry implementation. */
import type { PlacedBrick } from "../types";
import { brickPhysicalSolids, COURSE_MM, solidPolyhedron } from "./collisions";
import { convexIntersects, pointInPolyhedron, profileXZError, type ConvexPolyhedron } from "./convex";

export type Vec3 = [number, number, number];
export type ConvexPrism = { vertices: Vec3[]; faces: number[][]; min: Vec3; max: Vec3 };
export function brickPrisms(brick: PlacedBrick): ConvexPrism[] {
  return brickPhysicalSolids(brick).map((solid) => {
    const shape = solidPolyhedron(solid, (brick.row - 1) * COURSE_MM);
    const vertices: Vec3[] = shape.vertices.map(({ x, y, z }) => [x, y, z]);
    return {
      vertices,
      faces: shape.faces,
      min: [0, 1, 2].map((i) => Math.min(...vertices.map((v) => v[i]))) as Vec3,
      max: [0, 1, 2].map((i) => Math.max(...vertices.map((v) => v[i]))) as Vec3
    };
  });
}
const canonical = (prism: ConvexPrism): ConvexPolyhedron => ({
  faces: prism.faces,
  vertices: prism.vertices.map(([x, y, z]) => ({ x, y, z }))
});
export const convexOverlap = (a: ConvexPrism, b: ConvexPrism, toleranceMm = 1e-6): boolean => {
  if ([0, 1, 2].some((i) => Math.min(a.max[i], b.max[i]) - Math.max(a.min[i], b.min[i]) <= toleranceMm)) return false;
  return convexIntersects(canonical(a), canonical(b), toleranceMm);
};
export const pointInPrism = (shape: ConvexPrism, point: Vec3, toleranceMm = 1e-6): boolean => {
  if (point.some((v, i) => v < shape.min[i] - toleranceMm || v > shape.max[i] + toleranceMm)) return false;
  return pointInPolyhedron(canonical(shape), { x: point[0], y: point[1], z: point[2] }, toleranceMm);
};
export const validProfile = (points: unknown, widthMm: number): boolean =>
  profileXZError({ profileXZ: points, w: widthMm / 125, h: 1 }) === null;
