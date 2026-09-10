import { expect, it } from "vitest";
import { RUSSIAN_STOVE } from "../russianStove";
import {
  brickPhysicalSolids,
  solidPolyhedron,
  translatedPolyhedron,
  convexFaceContacts,
  convexIntersects
} from "../geometry";

it("has no masonry overlaps and a positive bearing-face chain to the foundation (not a load calculation)", () => {
  const world = Object.values(RUSSIAN_STOVE.rows)
    .flat()
    .filter((b) => b.kind === "custom")
    .flatMap((b) =>
      brickPhysicalSolids(b).map((s) => {
        const shape = translatedPolyhedron(solidPolyhedron(s), (b.row - 1) * 70);
        const bounds = (["x", "y", "z"] as const).map((k) => [
          Math.min(...shape.vertices.map((v) => v[k])),
          Math.max(...shape.vertices.map((v) => v[k]))
        ]);
        return { id: b.id, shape, bounds };
      })
    );
  const graph = world.map(() => new Set<number>());
  for (let i = 0; i < world.length; i++)
    for (let j = i + 1; j < world.length; j++) {
      const a = world[i],
        b = world[j];
      if (a.bounds.some(([lo, hi], k) => Math.max(lo, b.bounds[k][0]) - Math.min(hi, b.bounds[k][1]) > 5.1)) continue;
      if (a.bounds.every(([lo, hi], k) => Math.min(hi, b.bounds[k][1]) - Math.max(lo, b.bounds[k][0]) > 1e-5))
        expect(convexIntersects(a.shape, b.shape), `${a.id}/${b.id}`).toBe(false);
      if (convexFaceContacts(a.shape, b.shape, 5.1).some((c) => c.areaMm2 >= 100 && Math.abs(c.normalA.z) > 0.01)) {
        graph[i].add(j);
        graph[j].add(i);
      }
    }
  const founded = new Set(world.flatMap((s, i) => (s.bounds[2][0] <= 1e-6 ? [i] : [])));
  const queue = [...founded];
  for (let i = 0; i < queue.length; i++)
    for (const j of graph[queue[i]])
      if (!founded.has(j)) {
        founded.add(j);
        queue.push(j);
      }
  expect(world.filter((_, i) => !founded.has(i)).map((s) => s.id)).toEqual([]);
}, 30000);
