import { expect, it } from "vitest";
import { makeTeplushka15 } from "../teplushka15";
import { teplushkaVolume } from "./helpers/teplushkaVolume";
import {
  brickPhysicalSolids,
  solidPolyhedron,
  translatedPolyhedron,
  convexFaceContacts,
  pointInPolyhedron
} from "../geometry";

it("reconstructs the separate mouth fan lintel with inclined contacts into both skewbacks", () => {
  const bricks = Object.values(makeTeplushka15().rows).flat();
  const world = (b: (typeof bricks)[number]) =>
    brickPhysicalSolids(b).map((s) => translatedPolyhedron(solidPolyhedron(s), (b.row - 1) * 70));
  const wedges = bricks.filter((b) => b.custom?.name.startsWith("Устье · клинчатая перемычка"));
  const cheeks = bricks.filter((b) => b.custom?.name.startsWith("Устье · наклонная пята"));
  expect(wedges).toHaveLength(9);
  expect(cheeks).toHaveLength(4);
  const shapes = wedges.map((b) => world(b)[0]);
  for (const shape of shapes) {
    expect(Math.min(...shape.vertices.map((p) => p.z))).toBe(1050);
    expect(Math.max(...shape.vertices.map((p) => p.z))).toBe(1185);
    expect(Math.max(...shape.vertices.map((p) => p.y)) - Math.min(...shape.vertices.map((p) => p.y))).toBe(120);
  }
  const inclinedContact = (a: (typeof shapes)[number], b: (typeof shapes)[number]) =>
    convexFaceContacts(a, b, 5.1).some(
      (c) => c.areaMm2 >= 100 && Math.abs(c.normalA.z) > 0.01 && Math.abs(c.normalA.x) > 0.01
    );
  for (let i = 0; i < shapes.length - 1; i++) expect(inclinedContact(shapes[i], shapes[i + 1])).toBe(true);
  for (const end of [shapes[0], shapes[shapes.length - 1]])
    expect(cheeks.some((b) => world(b).some((s) => inclinedContact(end, s)))).toBe(true);
});

it("keeps the printed 350×280 mouth clear, with a flat fan-lintel intrados", () => {
  const shapes = Object.values(makeTeplushka15().rows)
    .flat()
    .flatMap((b) => brickPhysicalSolids(b).map((s) => translatedPolyhedron(solidPolyhedron(s), (b.row - 1) * 70)));
  const solid = (x: number, y: number, z: number) =>
    shapes.some((s) => pointInPolyhedron(s, { x: x + 125, y: y + 125, z }));
  for (const x of [441, 465, 615, 765, 789]) {
    for (const y of [481, 540, 599]) {
      for (const z of [771, 850, 1000, 1049]) expect(solid(x, y, z), `${x},${y},${z}`).toBe(false);
      expect(solid(x, y, 1051)).toBe(true);
    }
  }
});

it("keeps the shared inclined fan joint solid in the finite-volume audit", () => {
  const v = teplushkaVolume(Object.values(makeTeplushka15().rows).flat());
  // Exactly on the boundary between two voussoirs: strict <=0 rounding used
  // to exclude this sample from both solids, inventing a full-depth gas leak.
  for (const y of [480, 500, 540, 590]) expect(v.solid(680, y, 1095)).toBe(true);
});
