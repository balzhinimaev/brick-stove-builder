import { polyhedronFaces, type Point3Mm } from "../geometry";
import { vec } from "./model";

/** A 0.01 mm inward contact regularisation prevents coincident convex edges
 * from producing an arbitrary deep EPA manifold. Never expands an opening.
 * Mass and rendered geometry continue to use the unmodified source solid. */
export const CONTACT_INSET_MM = 0.01;
export function insetConvexPoints(points: Point3Mm[], faces?: number[][]): Point3Mm[] {
  const planes: { n: Point3Mm; d: number }[] = [];
  const add = (n: Point3Mm, d: number) => {
    if (!planes.some((p) => vec.dot(p.n, n) > 1 - 1e-8 && Math.abs(p.d - d) < 1e-5)) planes.push({ n, d });
  };
  if (faces) {
    for (const f of polyhedronFaces({ vertices: points, faces })) add(f.normal, vec.dot(f.normal, f.point));
  } else {
    // Half-beds are convex point clouds (usually 6–12 points), not AABB proxies.
    for (let i = 0; i < points.length; i++)
      for (let j = i + 1; j < points.length; j++)
        for (let k = j + 1; k < points.length; k++) {
          let n = vec.cross(vec.sub(points[j], points[i]), vec.sub(points[k], points[i]));
          const length = Math.hypot(n.x, n.y, n.z);
          if (length < 1e-7) continue;
          n = vec.mul(n, 1 / length);
          let d = vec.dot(n, points[i]);
          const distances = points.map((p) => vec.dot(n, p) - d);
          if (Math.max(...distances) <= 1e-5) add(n, d);
          else if (Math.min(...distances) >= -1e-5) {
            n = vec.mul(n, -1);
            d = -d;
            add(n, d);
          }
        }
  }
  const result: Point3Mm[] = [];
  for (let i = 0; i < planes.length; i++)
    for (let j = i + 1; j < planes.length; j++)
      for (let k = j + 1; k < planes.length; k++) {
        const a = planes[i],
          b = planes[j],
          c = planes[k];
        const bc = vec.cross(b.n, c.n),
          determinant = vec.dot(a.n, bc);
        if (Math.abs(determinant) < 1e-8) continue;
        const p = vec.mul(
          vec.add(
            vec.add(vec.mul(bc, a.d - CONTACT_INSET_MM), vec.mul(vec.cross(c.n, a.n), b.d - CONTACT_INSET_MM)),
            vec.mul(vec.cross(a.n, b.n), c.d - CONTACT_INSET_MM)
          ),
          1 / determinant
        );
        if (planes.some((plane) => vec.dot(plane.n, p) > plane.d - CONTACT_INSET_MM + 1e-5)) continue;
        if (!result.some((v) => Math.hypot(v.x - p.x, v.y - p.y, v.z - p.z) < 1e-5)) result.push(p);
      }
  if (result.length < 4) throw new Error("Грань слишком тонкая для контактного допуска 0,01 мм");
  return result;
}
