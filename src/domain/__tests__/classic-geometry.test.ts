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
it("keeps real 5 mm radial mortar beds, broad heels and staggered axial joints", () => {
  const stock = Object.values(CLASSIC_RUSSIAN_STOVE.rows).flat();
  const shape = (b: (typeof stock)[number]) => solidPolyhedron(brickPhysicalSolids(b)[0], (b.row - 1) * 70);
  const index = (b: (typeof stock)[number]) => Number(b.custom?.name.match(/клин (\d+)/)?.[1]);
  for (const name of ["Большое подпечье", "Малое подпечье", "Арка устья", "Свод горнила"]) {
    const wedges = stock.filter((b) => b.custom?.name.startsWith(`${name} · клин`));
    const n = Math.max(...wedges.map(index));
    expect(n % 2).toBe(1);
    if (name === "Большое подпечье" || name === "Свод горнила")
      expect(new Set(wedges.map((b) => b.row)).size).toBeGreaterThan(1);
    for (const wedge of wedges) {
      const i = index(wedge);
      expect(wedge.custom!.h * 125).toBeLessThanOrEqual(250);
      expect(wedge.custom!.h * 125).toBeGreaterThanOrEqual(60);
      const corners = wedge.custom!.profileXZ!;
      const [span, rise] =
        name === "Большое подпечье"
          ? [950, 170]
          : name === "Малое подпечье"
            ? [530, 70]
            : name === "Арка устья"
              ? [420, 70]
              : [960, 180];
      const radius = ((span / 2) ** 2 + rise ** 2) / (2 * rise),
        angle = Math.asin(span / 2 / radius);
      const a = -angle + ((i - 0.5) * 2 * angle) / n;
      const extent = (nx: number, nz: number) => {
        const values = corners.map((p) => nx * p.x + nz * p.z);
        return Math.max(...values) - Math.min(...values);
      };
      expect(extent(Math.cos(a), -Math.sin(a))).toBeLessThanOrEqual(65);
      expect(extent(Math.sin(a), Math.cos(a))).toBeLessThanOrEqual(120);
      const above = stock
        .filter((b) => b.custom?.name === `${name} · пята / пазуха`)
        .flatMap((b) => convexFaceContacts(shape(wedge), shape(b), 2.51))
        .filter((c) => c.normalA.z > 0);
      expect(above.reduce((sum, c) => sum + c.areaMm2, 0)).toBeGreaterThan(100);
      for (const c of above) expect(c.gapMm).toBeCloseTo(2.5, 5);
      for (const neighbor of [i - 1, i + 1]) {
        if (neighbor < 1 || neighbor > n) continue;
        const contacts = wedges
          .filter((b) => index(b) === neighbor)
          .flatMap((b) => convexFaceContacts(shape(wedge), shape(b), 5.01));
        expect(contacts.reduce((sum, c) => sum + c.areaMm2, 0)).toBeGreaterThan(3000);
        for (const c of contacts) expect(c.gapMm).toBeCloseTo(5, 5);
      }
      if (i === 1 || i === n) {
        const contacts = stock
          .filter((b) => b.custom?.name === `${name} · пята / пазуха`)
          .flatMap((b) => convexFaceContacts(shape(wedge), shape(b), 2.51));
        expect(contacts.reduce((sum, c) => sum + c.areaMm2, 0)).toBeGreaterThan(3000);
        for (const c of contacts) expect(c.gapMm).toBeCloseTo(2.5, 5);
      }
    }
    for (const filler of stock.filter((b) => b.custom?.name === `${name} · пята / пазуха`)) {
      expect(filler.custom!.w * 125).toBeLessThanOrEqual(250 + 1e-6);
      expect(filler.custom!.h * 125).toBeLessThanOrEqual(120 + 1e-6);
      const z = filler.custom!.profileXZ!.map((p) => p.z);
      expect(Math.max(...z) - Math.min(...z)).toBeLessThanOrEqual(65 + 1e-6);
    }
    const axial = (b: (typeof stock)[number]) => (b.orientation === "h" ? b.y : b.x) * 125;
    for (let i = 1; i < n; i++) {
      const a = wedges.filter((b) => index(b) === i).sort((a, b) => axial(a) - axial(b));
      const b = wedges.filter((b) => index(b) === i + 1).sort((a, b) => axial(a) - axial(b));
      for (let j = 1; j < a.length; j++) {
        expect(axial(a[j]) - axial(a[j - 1]) - a[j - 1].custom!.h * 125).toBeCloseTo(5, 5);
        for (const next of b.slice(1)) expect(Math.abs(axial(a[j]) - axial(next))).toBeGreaterThan(50);
      }
    }
  }
}, 30000);
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
