import { describe, expect, it } from "vitest";
import {
  brickPhysicalSolids,
  brickSolids,
  damperAperture,
  damperParts,
  grateParts,
  pointInSolid,
  solidsIntersect3D,
  brickPrisms,
  pointInPrism,
  damperGeometryError
} from "../geometry";
import type { PlacedBrick } from "../types";

const horizontal: PlacedBrick = {
  id: "summer",
  row: 13,
  x: 2,
  y: 3,
  kind: "damper",
  orientation: "h",
  damperOpen: 0,
  custom: { name: "130×130 clear gate", w: 150 / 125, h: 150 / 125, thicknessMm: 20, damperPlane: "horizontal" }
};
const vertical: PlacedBrick = {
  id: "mouth",
  row: 12,
  x: 4,
  y: 1,
  kind: "damper",
  orientation: "h",
  damperOpen: 0,
  custom: {
    name: "Removable mouth closure",
    w: 430 / 125,
    h: 4 / 125,
    heightMm: 280,
    seatZMm: 0,
    damperPlane: "vertical"
  }
};
const occupied = (brick: PlacedBrick, x: number, y: number, z: number) =>
  brickPhysicalSolids(brick).some((s) => pointInSolid(s, { x, y, z }));

describe("actual mode-dependent damper geometry", () => {
  it.each([0, 0.5, 1])("measures a true 130×130 horizontal aperture at fraction %s", (open) => {
    const brick = { ...horizontal, damperOpen: open };
    expect(damperAperture(brick).fullAreaMm2).toBe(130 * 130);
    expect(damperAperture(brick).openAreaMm2).toBe(130 * 130 * open);
    const xs = [270, 315, 370]; // clear local X 20,65,120 mm
    expect(xs.map((x) => occupied(brick, x, 440, 75))).toEqual(
      open === 0 ? [true, true, true] : open === 0.5 ? [false, false, true] : [false, false, false]
    );
    // Frame is retained at all openings, as is the blade filling its exit slot.
    expect(occupied(brick, 255, 440, 75)).toBe(true);
    expect(occupied(brick, 395, 440, 75)).toBe(true);
    const parts = damperParts(brick);
    for (let i = 0; i < parts.length; i++)
      for (let j = i + 1; j < parts.length; j++) expect(solidsIntersect3D(parts[i].solid, parts[j].solid)).toBe(false);
  });
  it("does not silently use an empty frame or the mounting envelope as its physical obstruction", () => {
    const open = { ...horizontal, damperOpen: 1 };
    expect(brickPhysicalSolids(open)).toHaveLength(6);
    expect(brickSolids(open)).toHaveLength(1);
    expect(brickPrisms(open).some((s) => pointInPrism(s, [315, 440, 12 * 70 + 75]))).toBe(false);
    expect(brickPhysicalSolids(open).some((s) => s.box.x2 > brickSolids(open)[0].box.x2)).toBe(true);
  });
  it.each([0, 0.5, 1])("lifts an actual 4 mm vertical plate by its physical opening at %s", (open) => {
    const brick = { ...vertical, damperOpen: open };
    expect(damperAperture(brick).openAreaMm2).toBe(430 * 280 * open);
    expect(brickPhysicalSolids(brick)[0].z1).toBe(280 * open);
    expect(occupied(brick, 600, 127, 70)).toBe(open === 0);
    expect(occupied(brick, 600, 127, 210)).toBe(open < 1);
    expect(occupied(brick, 600, 131, 210)).toBe(false); // not a 125 mm thick envelope
  });
  it("rotates the very same blade and aperture into plan Y", () => {
    const brick = { ...horizontal, orientation: "v" as const, damperOpen: 0.5 };
    expect(occupied(brick, 325, 400, 75)).toBe(false);
    expect(occupied(brick, 325, 495, 75)).toBe(true);
  });
  it("rejects malformed new vertical damper documents", () => {
    expect(damperGeometryError(vertical.custom)).toBeNull();
    expect(damperGeometryError({ ...vertical.custom, heightMm: undefined })).not.toBeNull();
    expect(damperGeometryError({ ...vertical.custom, seatZMm: NaN })).not.toBeNull();
  });
  it("keeps real grate slots between physical bars and frame", () => {
    const grate = { ...horizontal, kind: "grate" as const, custom: { name: "grate", w: 3, h: 2, thicknessMm: 22 } };
    const parts = grateParts(grate);
    expect(parts.filter((p) => p.role === "bar").length).toBeGreaterThan(0);
    expect(occupied(grate, 300, 391, 50)).toBe(false);
    expect(occupied(grate, 252, 390, 50)).toBe(true);
    expect(brickPhysicalSolids(grate)).not.toHaveLength(brickSolids(grate).length);
  });
});

describe("vertical source summer bypass gate", () => {
  const summer: PlacedBrick = {
    id: "summer-side",
    row: 11,
    x: 350 / 125,
    y: 520 / 125,
    kind: "damper",
    orientation: "h",
    damperOpen: 0,
    custom: {
      name: "Side-pulled 130×130 opening",
      w: 4 / 125,
      h: 150 / 125,
      heightMm: 150,
      seatZMm: 60,
      damperPlane: "vertical",
      damperSlide: "y-negative",
      damperFrameMm: 10
    }
  };
  it.each([0, 0.5, 1])("keeps the vertical frame while sliding toward front at %s", (open) => {
    const gate = { ...summer, damperOpen: open };
    expect(damperAperture(gate).fullAreaMm2).toBe(130 * 130);
    expect(damperAperture(gate).openAreaMm2).toBe(130 * 130 * open);
    expect(occupied(gate, 352, 550, 120)).toBe(open < 1);
    expect(occupied(gate, 352, 630, 120)).toBe(open === 0);
    expect(occupied(gate, 352, 665, 120)).toBe(true); // retained opposite jamb
    const parts = damperParts(gate);
    expect(parts).toHaveLength(6);
    for (let i = 0; i < parts.length; i++)
      for (let j = i + 1; j < parts.length; j++) expect(solidsIntersect3D(parts[i].solid, parts[j].solid)).toBe(false);
  });
  it("requires 130 mm actual storage/sweep clearance in the front shoulder", () => {
    const closed = damperParts(summer).find((p) => p.role === "blade")!.solid;
    const open = damperParts({ ...summer, damperOpen: 1 }).find((p) => p.role === "blade")!.solid;
    expect((closed.box.y1 - open.box.y1) * 125).toBeCloseTo(130);
    expect(open.z1).toBe(closed.z1);
    expect(open.z2).toBe(closed.z2);
    expect(damperGeometryError({ ...summer.custom, damperSlide: "x-negative" })).not.toBeNull();
    expect(damperGeometryError({ ...summer.custom, damperFrameMm: 75 })).not.toBeNull();
  });
  it("rotates the locally specified side motion with orientation v", () => {
    const rotated = { ...summer, orientation: "v" as const };
    const closed = damperParts(rotated).find((p) => p.role === "blade")!.solid;
    const open = damperParts({ ...rotated, damperOpen: 1 }).find((p) => p.role === "blade")!.solid;
    expect((open.box.x1 - closed.box.x1) * 125).toBeCloseTo(130);
    expect(open.box.y1).toBe(closed.box.y1);
  });
});
