import { expect, it } from "vitest";
import {
  brickPhysicalSolids,
  convexFaceContacts,
  convexIntersects,
  profileXZError,
  solidPolyhedron,
  translatedPolyhedron
} from "../geometry";
import { HOUSE_RUSSIAN_STOVE, HOUSE_RUSSIAN_STOVE_R2 } from "../houseRussianStove";

it.each([HOUSE_RUSSIAN_STOVE, HOUSE_RUSSIAN_STOVE_R2])(
  "$id: valid profiles, no intersections and founded bearing faces",
  (project) => {
    const stock = Object.values(project.rows).flat();
    for (const b of stock) if (b.custom?.profileXZ) expect(profileXZError(b.custom), b.id).toBeNull();
    const world = stock.flatMap((b) =>
      brickPhysicalSolids(b).map((s) => {
        const shape = translatedPolyhedron(solidPolyhedron(s), (b.row - 1) * 70);
        const bounds = (["x", "y", "z"] as const).map((k) => [
          Math.min(...shape.vertices.map((v) => v[k])),
          Math.max(...shape.vertices.map((v) => v[k]))
        ]);
        return { id: b.id, name: b.custom?.name, kind: b.kind, shape, bounds };
      })
    );
    const graph = world.map(() => new Set<number>()),
      overlaps: string[] = [];
    for (let i = 0; i < world.length; i++)
      for (let j = i + 1; j < world.length; j++) {
        const a = world[i],
          b = world[j];
        if (a.id === b.id) {
          graph[i].add(j);
          graph[j].add(i);
          continue;
        }
        if (a.bounds.some(([lo, hi], k) => Math.max(lo, b.bounds[k][0]) - Math.min(hi, b.bounds[k][1]) > 5 + 1e-6))
          continue;
        if (
          a.bounds.every(([lo, hi], k) => Math.min(hi, b.bounds[k][1]) - Math.max(lo, b.bounds[k][0]) > 1e-5) &&
          convexIntersects(a.shape, b.shape)
        )
          overlaps.push(`${a.id} (${a.name}) / ${b.id} (${b.name})`);
        if (
          a.kind === "custom" &&
          b.kind === "custom" &&
          convexFaceContacts(a.shape, b.shape, 5, 0.02).some((c) => c.areaMm2 >= 100 && Math.abs(c.normalA.z) > 0.01)
        ) {
          graph[i].add(j);
          graph[j].add(i);
        }
      }
    expect.soft(overlaps.slice(0, 35), `${overlaps.length} intersections`).toEqual([]);
    const founded = new Set(world.flatMap((s, i) => (s.bounds[2][0] <= 1e-6 ? [i] : []))),
      queue = [...founded];
    for (let i = 0; i < queue.length; i++)
      for (const j of graph[queue[i]])
        if (!founded.has(j)) {
          founded.add(j);
          queue.push(j);
        }
    const unsupported = world.filter((s, i) => s.kind === "custom" && !founded.has(i));
    expect(
      unsupported.slice(0, 25).map((s) => ({ id: s.id, name: s.name, bounds: s.bounds })),
      `${unsupported.length} unsupported`
    ).toEqual([]);
  },
  90000
);
it.each([HOUSE_RUSSIAN_STOVE, HOUSE_RUSSIAN_STOVE_R2])("$id: gate travel stays clear", (project) => {
  const stock = Object.values(project.rows).flat();
  for (const b of stock.filter((b) => b.kind === "damper"))
    for (const damperOpen of [0, 0.25, 0.5, 0.75, 1]) {
      const gate = { ...b, damperOpen };
      for (const other of stock)
        if (other.id !== b.id)
          expect(brickPhysicalOverlap(gate, other), `${b.id} ${damperOpen} / ${other.id}`).toBe(false);
    }
});

import { brickPhysicalOverlap } from "../geometry";
