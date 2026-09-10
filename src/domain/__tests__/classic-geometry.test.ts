import { expect, it } from "vitest";
import { CLASSIC_RUSSIAN_STOVE } from "../classicRussianStove";
import {
  brickPhysicalSolids,
  solidPolyhedron,
  translatedPolyhedron,
  convexFaceContacts,
  convexIntersects,
  profileXZError
} from "../geometry";
it("has valid canonical profiles, no actual solid intersections and founded bearing faces", () => {
  const stock = Object.values(CLASSIC_RUSSIAN_STOVE.rows).flat();
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
      if (
        a.id === b.id ||
        a.bounds.some(([lo, hi], k) => Math.max(lo, b.bounds[k][0]) - Math.min(hi, b.bounds[k][1]) > 5.1)
      )
        continue;
      if (
        a.bounds.every(([lo, hi], k) => Math.min(hi, b.bounds[k][1]) - Math.max(lo, b.bounds[k][0]) > 1e-5) &&
        convexIntersects(a.shape, b.shape)
      )
        overlaps.push(`${a.id} (${a.name}) / ${b.id} (${b.name})`);
      if (
        a.kind === "custom" &&
        b.kind === "custom" &&
        convexFaceContacts(a.shape, b.shape, 5.1).some((c) => c.areaMm2 >= 100 && Math.abs(c.normalA.z) > 0.01)
      ) {
        graph[i].add(j);
        graph[j].add(i);
      }
    }
  expect(overlaps.slice(0, 100), `${overlaps.length} intersections`).toEqual([]);
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
}, 30000);
it("retains broad radial contacts to both skewbacks in every vault bay", () => {
  const stock = Object.values(CLASSIC_RUSSIAN_STOVE.rows).flat();
  for (const name of ["Большое подпечье", "Малое подпечье", "Арка устья", "Свод горнила"]) {
    const wedges = stock.filter((b) => b.custom?.name.startsWith(`${name} · клин`));
    const bays = new Map<number, typeof wedges>();
    for (const b of wedges) {
      const key = b.orientation === "h" ? b.y : b.x;
      bays.set(key, [...(bays.get(key) ?? []), b]);
    }
    expect(bays.size).toBeGreaterThan(0);
    const shape = (b: (typeof stock)[number]) => solidPolyhedron(brickPhysicalSolids(b)[0], (b.row - 1) * 70);
    for (const bay of bays.values()) {
      expect(bay).toHaveLength(15);
      for (let i = 1; i < bay.length; i++)
        expect(
          convexFaceContacts(shape(bay[i - 1]), shape(bay[i]), 0).reduce((s, c) => s + c.areaMm2, 0)
        ).toBeGreaterThan(3000);
      for (const end of [bay[0], bay[14]]) {
        const contacts = stock
          .filter((b) => b.custom?.name === `${name} · пята / пазуха`)
          .flatMap((b) => convexFaceContacts(shape(end), shape(b), 0));
        expect(contacts.reduce((s, c) => s + c.areaMm2, 0)).toBeGreaterThan(3000);
      }
    }
  }
});
it("moves each physical gate through its reserved slot without hitting any other solid", () => {
  const stock = Object.values(CLASSIC_RUSSIAN_STOVE.rows).flat();
  for (const b of stock.filter((b) => b.kind === "damper"))
    for (const damperOpen of [0, 0.25, 0.5, 0.75, 1]) {
      const gate = { ...b, damperOpen };
      for (const other of stock)
        if (other.id !== b.id)
          expect(brickPhysicalOverlap(gate, other), `${b.id} ${damperOpen} / ${other.id}`).toBe(false);
    }
});
import { brickPhysicalOverlap } from "../geometry";
