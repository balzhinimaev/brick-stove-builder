import { expect, it } from "vitest";
import { makeTeplushka15 } from "../teplushka15";
import { brickSolids, solidPolyhedron, profilePolyhedron, translatedPolyhedron, convexIntersects } from "../geometry";
it("has no positive-volume physical intersections including hardware", () => {
  const bricks = Object.values(makeTeplushka15().rows).flat();
  const shapes = bricks.map((brick) => {
    const profile = profilePolyhedron(brick);
    const solids = profile
      ? [translatedPolyhedron(profile, (brick.row - 1) * 70)]
      : brickSolids(brick).map((s) => solidPolyhedron(s, (brick.row - 1) * 70));
    const vertices = solids.flatMap((s) => s.vertices);
    const bounds = ["x", "y", "z"].map((axis) => [
      Math.min(...vertices.map((p) => p[axis as "x" | "y" | "z"])),
      Math.max(...vertices.map((p) => p[axis as "x" | "y" | "z"]))
    ]);
    return { brick, solids, bounds };
  });
  const collisions: string[] = [];
  for (let i = 0; i < shapes.length; i++)
    for (let j = i + 1; j < shapes.length; j++) {
      const a = shapes[i],
        b = shapes[j];
      if (
        a.bounds.every((bnd, k) => Math.min(bnd[1], b.bounds[k][1]) - Math.max(bnd[0], b.bounds[k][0]) > 1e-6) &&
        a.solids.some((p) => b.solids.some((q) => convexIntersects(p, q)))
      )
        collisions.push(
          `${a.brick.id} r${a.brick.row} ${a.brick.custom?.name} / ${b.brick.id} r${b.brick.row} ${b.brick.custom?.name}`
        );
    }
  expect(collisions).toEqual([]);
});
