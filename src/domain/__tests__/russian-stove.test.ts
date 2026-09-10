import { describe, it, expect } from "vitest";
import { makeRussianStove, RUSSIAN_STOVE, TEPLUSHKA_SOURCE, TEPLUSHKA_DAMPER_IDS } from "../russianStove";
import {
  gridFromParameters,
  isInsideGrid,
  profilePolyhedron,
  translatedPolyhedron,
  convexFaceContacts,
  profileXZError
} from "../geometry";
const bricks = Object.values(RUSSIAN_STOVE.rows).flat();
describe("source-selected small Teplushka-15", () => {
  it("keeps the guest/editor ID, 33 courses, exact 1290 mm body and 710×410 hob", () => {
    expect(RUSSIAN_STOVE.id).toBe("russian-stove-hob");
    expect(RUSSIAN_STOVE.rowCount).toBe(33);
    expect(Object.keys(RUSSIAN_STOVE.rows).map(Number)).toEqual(Array.from({ length: 33 }, (_, i) => i + 1));
    const grid = gridFromParameters(RUSSIAN_STOVE.parameters);
    expect(bricks.every((b) => isInsideGrid(b, grid))).toBe(true);
    const base = RUSSIAN_STOVE.rows[1];
    expect(
      Math.max(...base.map((b) => (b.x + b.custom!.w) * 125)) - Math.min(...base.map((b) => b.x * 125))
    ).toBeCloseTo(1290);
    expect(
      Math.max(...base.map((b) => (b.y + b.custom!.h) * 125)) - Math.min(...base.map((b) => b.y * 125))
    ).toBeCloseTo(1290);
    const plate = bricks.find((b) => b.kind === "plate")!;
    expect([plate.custom!.w * 125, plate.custom!.h * 125]).toEqual([710, 410]);
  });
  it("exports two bells, six parallel descents, complete source row mapping and independent controls", () => {
    expect(TEPLUSHKA_SOURCE.bells).toEqual(["upper-cooking", "lower-heating"]);
    expect(TEPLUSHKA_SOURCE.downports).toHaveLength(6);
    expect(TEPLUSHKA_SOURCE.rows).toHaveLength(33);
    expect(TEPLUSHKA_SOURCE.rows[32].pdfPage).toBe(43);
    expect(new Set(Object.values(TEPLUSHKA_DAMPER_IDS)).size).toBe(4);
    for (const id of Object.values(TEPLUSHKA_DAMPER_IDS)) expect(bricks.filter((b) => b.id === id)).toHaveLength(1);
  });
  it("uses validated radial profiles, with a positive-face chain to both skewbacks in every barrel bay", () => {
    const profiled = bricks.filter((b) => b.custom?.profileXZ);
    expect(profiled.length).toBeGreaterThan(102);
    for (const b of profiled) expect(profileXZError(b.custom), b.id).toBeNull();
    const shape = (b: (typeof bricks)[number]) => translatedPolyhedron(profilePolyhedron(b)!, 70 * (b.row - 1));
    for (let bay = 1; bay <= 6; bay++) {
      const chain = profiled.filter((b) => b.custom!.name.startsWith(`Свод · R880 · пояс ${bay} ·`));
      expect(chain).toHaveLength(17);
      for (let i = 1; i < chain.length; i++)
        expect(
          convexFaceContacts(shape(chain[i - 1]), shape(chain[i]), 0).reduce((n, c) => n + c.areaMm2, 0)
        ).toBeGreaterThan(10000);
      for (const end of [chain[0], chain[16]]) {
        const contacts = profiled
          .filter((b) => b.custom!.name.includes("пята/") && b.y === end.y)
          .flatMap((b) => convexFaceContacts(shape(end), shape(b), 0));
        expect(contacts.reduce((n, c) => n + c.areaMm2, 0)).toBeGreaterThan(9000);
      }
    }
  });
  it("creates independent editable profile arrays on repeated construction", () => {
    const copy = Object.values(makeRussianStove().rows).flat();
    const a = bricks.find((b) => b.custom?.profileXZ)!,
      b = copy.find((b) => b.id === a.id)!;
    b.custom!.profileXZ![0].x += 1;
    expect(b.custom!.profileXZ![0].x).not.toBe(a.custom!.profileXZ![0].x);
  });
});
