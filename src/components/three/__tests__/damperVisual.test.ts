import { describe, expect, it } from "vitest";
import { Plane, Vector3 } from "three";
import { brickPhysicalSolids, damperParts, gridFromParameters } from "../../../domain/geometry";
import { DEFAULT_PARAMETERS } from "../../../domain/constants";
import { makeHouseRussianStove } from "../../../domain/houseRussianStove";
import type { PlacedBrick } from "../../../domain/types";
import { damperVisualParts } from "../damperVisual";
import { archSceneBounds } from "../ClassicArchOverlay";
import { solidSceneBox } from "../sceneMath";
import { sectionScene } from "../sectionGeometry";

const grid = gridFromParameters(DEFAULT_PARAMETERS);
const gate = {
  id: "edited-copy-gate",
  row: 23,
  x: 2,
  y: 3,
  orientation: "h",
  kind: "damper",
  custom: {
    name: "edited gate",
    w: 5 / 125,
    h: 180 / 125,
    heightMm: 280,
    thicknessMm: 5,
    damperPlane: "vertical",
    damperFrameMm: 0
  }
} satisfies PlacedBrick;

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing expected part");
  return value;
}

describe("render-only damper recognition", () => {
  it("verifies R1's upper gate is installed in row 23, fully raised, 180 × 280 × 5", () => {
    const project = makeHouseRussianStove();
    const upper = required(
      Object.values(project.rows)
        .flat()
        .find((b) => b.id.includes("upper-loop-gate"))
    );
    expect(upper).toBeDefined();
    expect(upper.row).toBe(23);
    expect(upper.damperOpen).toBe(1);
    expect(upper.custom).toMatchObject({
      w: 5 / 125,
      h: 180 / 125,
      heightMm: 280,
      thicknessMm: 5,
      damperPlane: "vertical",
      damperSlide: "up",
      damperFrameMm: 0
    });
    const blade = damperParts(upper)[0].solid;
    expect(blade.z1).toBe(280);
    expect(blade.z2).toBe(560);
  });
  for (const plane of ["vertical", "horizontal"] as const) {
    for (const orientation of ["h", "v"] as const) {
      it.each([0, 0.35, 1])(`${plane}/${orientation}: stable guides and exact physical blade at %s`, (damperOpen) => {
        const custom =
          plane === "vertical"
            ? gate.custom
            : { name: "custom horizontal", w: 2.7, h: 1.3, thicknessMm: 37, seatZMm: 41 };
        const brick = { ...gate, orientation, custom, damperOpen };
        const saved = JSON.stringify(brick),
          physical = brickPhysicalSolids(brick);
        const parts = damperVisualParts(brick, grid);
        const closed = damperVisualParts({ ...brick, damperOpen: 0 }, grid);
        expect(parts.filter((p) => p.role === "guide")).toEqual(closed.filter((p) => p.role === "guide"));
        expect(parts.filter((p) => p.role === "handle")).toHaveLength(3);
        const blade = solidSceneBox(
          required(damperParts(brick).find((p) => p.role === "blade")).solid,
          brick.row,
          grid
        );
        expect(parts.find((p) => p.role === "blade")).toEqual({ ...blade, role: "blade" });
        const bounds = archSceneBounds([brick], grid);
        for (const p of parts) {
          expect(p.scale.every((n) => Number.isFinite(n) && n > 0)).toBe(true);
          for (const sign of [-1, 1])
            expect(bounds.containsPoint(new Vector3(...p.position.map((v, i) => v + (sign * p.scale[i]) / 2)))).toBe(
              true
            );
        }
        expect(JSON.stringify(brick)).toBe(saved);
        expect(brickPhysicalSolids(brick)).toEqual(physical);
      });
    }
  }
  it.each(["h", "v"] as const)("follows a custom negative side-slide in orientation %s", (orientation) => {
    const brick: PlacedBrick = {
      ...gate,
      orientation,
      custom: { ...gate.custom, w: 9 / 125, h: 240 / 125, heightMm: 190, damperSlide: "y-negative", damperFrameMm: 12 }
    };
    const closed = damperVisualParts({ ...brick, damperOpen: 0 }, grid);
    const open = damperVisualParts({ ...brick, damperOpen: 1 }, grid);
    const axis = orientation === "h" ? 2 : 0;
    const delta =
      required(open.find((p) => p.role === "blade")).position[axis] -
      required(closed.find((p) => p.role === "blade")).position[axis];
    expect(delta).toBeCloseTo(((orientation === "h" ? -1 : 1) * 216) / 125);
    open
      .filter((p) => p.role === "handle")
      .forEach((p, i) => {
        expect(p.position[axis] - closed.filter((p) => p.role === "handle")[i].position[axis]).toBeCloseTo(delta);
      });
  });
  it("retains and caps schematic guides when the physical raised blade is outside a section", () => {
    const brick = { ...gate, damperOpen: 1 };
    const plane = new Plane(new Vector3(0, -1, 0), ((brick.row - 1) * 70 + 140) / 125);
    const section = sectionScene([brick], grid, plane);
    expect(section.retainedBrickIds.has(brick.id)).toBe(true);
    expect(section.geometry.getAttribute("position").count).toBeGreaterThan(0);
    expect(section.bounds.max.y).toBeCloseTo(plane.constant);
    section.geometry.dispose();
  });
});
