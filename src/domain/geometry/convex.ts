import { profileXZError } from "../../../shared/profileXZ.js";
import { MM_PER_CELL } from "../constants";
import type { BrickFootprint } from "../types";

export { profileXZError };
export type Point3Mm = { x: number; y: number; z: number };
/** All vertices use millimetres, plan coordinates absolute, vertical coordinates relative to a course. */
export type ConvexPolyhedron = { vertices: Point3Mm[]; faces: number[][] };
const EPS = 1e-6;
const sub = (a: Point3Mm, b: Point3Mm): Point3Mm => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a: Point3Mm, b: Point3Mm): Point3Mm => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x
});
const dot = (a: Point3Mm, b: Point3Mm) => a.x * b.x + a.y * b.y + a.z * b.z;
const length = (a: Point3Mm) => Math.hypot(a.x, a.y, a.z);

export function profilePolyhedron(brick: BrickFootprint): ConvexPolyhedron | null {
  if (!brick.custom?.profileXZ) return null;
  const error = profileXZError(brick.custom);
  if (error || brick.kind !== "custom") throw new Error(error ?? "Profiles are only supported by custom solids");
  const { profileXZ, h } = brick.custom;
  const n = profileXZ.length;
  const vertices: Point3Mm[] = [0, h * MM_PER_CELL].flatMap((y) =>
    profileXZ.map(({ x, z }) => ({
      x: brick.x * MM_PER_CELL + (brick.orientation === "h" ? x : h * MM_PER_CELL - y),
      y: brick.y * MM_PER_CELL + (brick.orientation === "h" ? y : x),
      z
    }))
  );
  const faces = [Array.from({ length: n }, (_, i) => n - 1 - i), Array.from({ length: n }, (_, i) => n + i)];
  for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, ((i + 1) % n) + n, i + n]);
  return { vertices, faces };
}

export function translatedPolyhedron(shape: ConvexPolyhedron, dz: number): ConvexPolyhedron {
  return { faces: shape.faces, vertices: shape.vertices.map((v) => ({ ...v, z: v.z + dz })) };
}

export function polyhedronFaces(
  shape: ConvexPolyhedron
): { point: Point3Mm; normal: Point3Mm; vertices: Point3Mm[] }[] {
  const center = shape.vertices.reduce(
    (a, p) => ({
      x: a.x + p.x / shape.vertices.length,
      y: a.y + p.y / shape.vertices.length,
      z: a.z + p.z / shape.vertices.length
    }),
    { x: 0, y: 0, z: 0 }
  );
  return shape.faces.map((face) => {
    const vertices = face.map((i) => shape.vertices[i]);
    const point = vertices[0];
    const raw = cross(sub(vertices[1], point), sub(vertices[2], point));
    const scale = (dot(raw, sub(center, point)) > 0 ? -1 : 1) / length(raw);
    return { point, vertices, normal: { x: raw.x * scale, y: raw.y * scale, z: raw.z * scale } };
  });
}

function edges(shape: ConvexPolyhedron): Point3Mm[] {
  return shape.faces.flatMap((face) =>
    face.map((index, i) => sub(shape.vertices[face[(i + 1) % face.length]], shape.vertices[index]))
  );
}

/** Full 3D separating-axis test: face normals AND cross products of edges. Touching is not penetration. */
export function convexIntersects(a: ConvexPolyhedron, b: ConvexPolyhedron, epsilonMm = EPS): boolean {
  const axes = [...polyhedronFaces(a).map((f) => f.normal), ...polyhedronFaces(b).map((f) => f.normal)];
  const ae = edges(a);
  const be = edges(b);
  for (const edgeA of ae) for (const edgeB of be) axes.push(cross(edgeA, edgeB));
  for (const axis of axes) {
    const norm = length(axis);
    if (norm < EPS) continue;
    const ap = a.vertices.map((p) => dot(p, axis) / norm);
    const bp = b.vertices.map((p) => dot(p, axis) / norm);
    if (Math.min(Math.max(...ap), Math.max(...bp)) - Math.max(Math.min(...ap), Math.min(...bp)) <= epsilonMm)
      return false;
  }
  return true;
}

export function pointInPolyhedron(shape: ConvexPolyhedron, point: Point3Mm, toleranceMm = EPS): boolean {
  return polyhedronFaces(shape).every((face) => dot(face.normal, sub(point, face.point)) <= toleranceMm);
}

/** Geometry volume for estimates/audits, not a bounding-box proxy. */
export function polyhedronVolumeMm3(shape: ConvexPolyhedron): number {
  let volume = 0;
  for (const { vertices, normal } of polyhedronFaces(shape)) {
    for (let i = 1; i < vertices.length - 1; i++) {
      const a = vertices[0];
      const b = vertices[i];
      const c = vertices[i + 1];
      const winding = dot(cross(sub(b, a), sub(c, a)), normal) >= 0 ? 1 : -1;
      volume += (winding * dot(a, cross(b, c))) / 6;
    }
  }
  return Math.abs(volume);
}

type Point2 = { x: number; y: number };
const cross2 = (a: Point2, b: Point2, c: Point2) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const signedArea2 = (points: Point2[]) =>
  points.reduce((sum, a, i) => {
    const b = points[(i + 1) % points.length];
    return sum + a.x * b.y - a.y * b.x;
  }, 0) / 2;
function clipPolygon(subject: Point2[], clip: Point2[]): Point2[] {
  let result = subject;
  const sign = Math.sign(signedArea2(clip));
  for (let i = 0; i < clip.length && result.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const input = result;
    result = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j];
      const q = input[(j + 1) % input.length];
      const dp = sign * cross2(a, b, p);
      const dq = sign * cross2(a, b, q);
      if (dp >= -EPS) result.push(p);
      if (dp >= -EPS !== dq >= -EPS) {
        const t = dp / (dp - dq);
        result.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
      }
    }
  }
  return result;
}

export type FaceContact = { areaMm2: number; gapMm: number; normalA: Point3Mm; polygonMm: Point3Mm[] };
/**
 * Positive-area opposing face contacts, including inclined voussoir joints.
 * Measures actual projected face overlap, not AABB contact or a point touch.
 * A small nonnegative face gap may represent mortar. This is geometry, not a
 * thrust-line, material strength or structural stability calculation.
 * Optional faceAngleTolerance (radians) admits fan beds only when every opposing
 * face vertex stays within the mortar budget. Default keeps parallel-only behavior.
 */
export function convexFaceContacts(
  a: ConvexPolyhedron,
  b: ConvexPolyhedron,
  mortarToleranceMm = 5,
  faceAngleTolerance = 0
): FaceContact[] {
  const contacts: FaceContact[] = [];
  for (const af of polyhedronFaces(a))
    for (const bf of polyhedronFaces(b)) {
      if (dot(af.normal, bf.normal) > -Math.cos(faceAngleTolerance) + 1e-8) continue;
      const distances = bf.vertices.map((p) => dot(af.normal, sub(p, af.point)));
      // Signed distance to a plane is affine: extrema on a convex face occur
      // at vertices. Bounding every vertex therefore bounds the entire bed,
      // not just a sample or the first corner; overlap area is checked below.
      if (faceAngleTolerance > 0 && (Math.min(...distances) < -EPS || Math.max(...distances) > mortarToleranceMm + EPS))
        continue;
      const gapMm = dot(af.normal, sub(bf.point, af.point));
      if (gapMm < -EPS || gapMm > mortarToleranceMm + EPS) continue;
      const edge = sub(af.vertices[1], af.point);
      const norm = length(edge);
      const u = { x: edge.x / norm, y: edge.y / norm, z: edge.z / norm };
      const v = cross(af.normal, u);
      const project = (p: Point3Mm): Point2 => ({ x: dot(sub(p, af.point), u), y: dot(sub(p, af.point), v) });
      const polygon = clipPolygon(af.vertices.map(project), bf.vertices.map(project));
      const areaMm2 = Math.abs(signedArea2(polygon));
      if (areaMm2 <= EPS) continue;
      contacts.push({
        areaMm2,
        gapMm: Math.max(0, gapMm),
        normalA: af.normal,
        polygonMm: polygon.map((p) => ({
          x: af.point.x + p.x * u.x + p.y * v.x,
          y: af.point.y + p.x * u.y + p.y * v.y,
          z: af.point.z + p.x * u.z + p.y * v.z
        }))
      });
    }
  return contacts;
}
