import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMETERS } from "../constants";
import { estimateMaterials } from "../materials";
import { READY_PROJECTS } from "../projects";
import type { PlacedBrick } from "../types";

function brick(kind: PlacedBrick["kind"], i: number): PlacedBrick {
  return { id: `b${i}`, row: 1, x: 0, y: 0, kind, orientation: "h" };
}

describe("estimateMaterials", () => {
  it("counts each brick category and totals correctly", () => {
    const bricks: PlacedBrick[] = [
      brick("standard", 0),
      brick("standard", 1),
      brick("firebrick", 2),
      brick("cut", 3),
      brick("cleanout", 4),
      brick("grate", 5),
      brick("trim", 6),
      brick("trim", 7)
    ];
    const m = estimateMaterials(bricks, DEFAULT_PARAMETERS);
    expect(m.regularBricks).toBe(2);
    expect(m.firebricks).toBe(1);
    expect(m.grates).toBe(1);
    // cut + cleanout (=2) + two trims counted as 0.5 each (=1) => 3
    expect(m.cutBricks).toBe(3);
    expect(m.total).toBe(8);
  });

  it("computes concrete volume from foundation dimensions in m³", () => {
    const m = estimateMaterials([], { foundationWidth: 100, foundationLength: 200, foundationThickness: 25, roomHeight: 260 });
    // 1.0 × 2.0 × 0.25 = 0.5
    expect(m.concreteVolumeM3).toBeCloseTo(0.5, 6);
  });

  it("produces a self-consistent estimate for the compact heater project", () => {
    const project = READY_PROJECTS[0];
    const flat = Object.values(project.rows).flat();
    const m = estimateMaterials(flat, project.parameters);
    expect(m.total).toBe(flat.length);
    for (const value of Object.values(m)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
    expect(m.mortarM3).toBeGreaterThan(0);
    expect(m.concreteVolumeM3).toBeGreaterThan(0);
  });
});
