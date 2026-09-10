import { describe, expect, it } from "vitest";
import {
  convexFaceContacts,
  convexIntersects,
  pointInPolyhedron,
  polyhedronVolumeMm3,
  profilePolyhedron,
  profileXZError,
  translatedPolyhedron
} from "../geometry/convex";
import type { PlacedBrick } from "../types";

const wedge: PlacedBrick = {
  id: "voussoir",
  kind: "custom",
  row: 1,
  x: 0,
  y: 0,
  orientation: "h",
  custom: {
    name: "Inclined individual brick",
    w: 2,
    h: 1,
    profileXZ: [
      { x: 0, z: 0 },
      { x: 250, z: 150 },
      { x: 250, z: 215 },
      { x: 0, z: 65 }
    ],
    cutFrom: "firebrick"
  }
};
const shape = () => profilePolyhedron(wedge)!;

describe("canonical convex masonry", () => {
  it("validates units, strict convexity, winding, and unsupported cuts", () => {
    expect(profileXZError(wedge.custom)).toBeNull();
    expect(profileXZError({ ...wedge.custom, profileXZ: [...wedge.custom!.profileXZ!].reverse() })).toBeNull();
    for (const spec of [
      { ...wedge.custom, w: 1.99 },
      { ...wedge.custom, h: Infinity },
      { ...wedge.custom, notch: { x1: 0, x2: 1, y1: 0, y2: 1 } },
      { ...wedge.custom, seatZMm: 0 },
      {
        ...wedge.custom,
        profileXZ: [
          { x: 0, z: 0 },
          { x: 250, z: 0 },
          { x: 125, z: 1 },
          { x: 0, z: 65 }
        ]
      },
      {
        ...wedge.custom,
        profileXZ: [
          { x: 0, z: 0 },
          { x: 250, z: 0 },
          { x: 250, z: Infinity }
        ]
      },
      {
        ...wedge.custom,
        profileXZ: [
          { x: 0, z: 0 },
          { x: 250, z: 65 },
          { x: 0, z: 65 },
          { x: 250, z: 0 }
        ]
      }
    ])
      expect(profileXZError(spec)).not.toBeNull();
  });

  it("supports triangular voussoirs and refuses profiles on metal hardware", () => {
    const triangular = {
      ...wedge,
      custom: {
        ...wedge.custom!,
        profileXZ: [
          { x: 0, z: 0 },
          { x: 250, z: 0 },
          { x: 125, z: 65 }
        ]
      }
    };
    expect(profilePolyhedron(triangular)!.faces).toHaveLength(5);
    expect(polyhedronVolumeMm3(profilePolyhedron(triangular)!)).toBeCloseTo((250 * 125 * 65) / 2);
    expect(() => profilePolyhedron({ ...wedge, kind: "plate" })).toThrow();
  });

  it("extrudes millimetres from cell depth and rotates the same prism in plan", () => {
    const rotated = profilePolyhedron({ ...wedge, x: 2, y: 3, orientation: "v" })!;
    expect(rotated.vertices[0]).toEqual({ x: 375, y: 375, z: 0 });
    expect(rotated.vertices[5]).toEqual({ x: 250, y: 625, z: 150 });
    expect(polyhedronVolumeMm3(rotated)).toBeCloseTo(250 * 125 * 65);
  });

  it("does not substitute the AABB for an inclined occupied volume", () => {
    expect(pointInPolyhedron(shape(), { x: 230, y: 60, z: 10 })).toBe(false);
    expect(pointInPolyhedron(shape(), { x: 230, y: 60, z: 160 })).toBe(true);
    const separated = translatedPolyhedron(shape(), 70);
    expect(convexIntersects(shape(), separated)).toBe(false);
    expect(convexIntersects(shape(), translatedPolyhedron(shape(), 64))).toBe(true);
    expect(convexIntersects(shape(), translatedPolyhedron(shape(), 65))).toBe(false);
  });

  it("measures true inclined bearing area across mortar, rejecting gaps and edge touches", () => {
    const contacts = convexFaceContacts(shape(), translatedPolyhedron(shape(), 70));
    expect(contacts).toHaveLength(1);
    expect(contacts[0].areaMm2).toBeCloseTo(Math.hypot(250, 150) * 125 - ((5 * 150) / Math.hypot(250, 150)) * 125);
    expect(contacts[0].gapMm).toBeCloseTo((5 * 250) / Math.hypot(250, 150));
    expect(Math.abs(contacts[0].normalA.z)).toBeGreaterThan(0.8);
    expect(convexFaceContacts(shape(), translatedPolyhedron(shape(), 80))).toEqual([]);
    expect(convexFaceContacts(shape(), profilePolyhedron({ ...wedge, x: 2, y: 1 })!)).toEqual([]);
  });
});
