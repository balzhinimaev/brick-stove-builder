import { beforeAll, describe, expect, it } from "vitest";
import { pointInPolyhedron } from "../geometry";
import { buildPhysicsModel, DEFAULT_PHYSICS, GRAVITY, mortarPads, type PhysicsSettings } from "../physics/model";
import { GravitySimulation, initPhysics } from "../physics/simulation";
import type { CustomBrickSpec, PlacedBrick } from "../types";

const grid = { cols: 16, rows: 20, widthCm: 200, lengthCm: 250 };
function box(
  id: string,
  x: number,
  y: number,
  z: number,
  w = 250,
  d = 120,
  h = 65
): PlacedBrick & { custom: CustomBrickSpec } {
  const row = Math.floor(z / 70) + 1,
    base = z - (row - 1) * 70;
  return {
    id,
    row,
    x: x / 125,
    y: y / 125,
    kind: "custom",
    orientation: "h",
    custom: {
      name: id,
      w: w / 125,
      h: d / 125,
      profileXZ: [
        { x: 0, z: base },
        { x: w, z: base },
        { x: w, z: base + h },
        { x: 0, z: base + h }
      ]
    }
  };
}
const model = (bricks: PlacedBrick[], settings: Partial<PhysicsSettings> = {}) =>
  buildPhysicsModel(bricks, grid, { ...DEFAULT_PHYSICS, ...settings });
beforeAll(initPhysics);

describe("geometry and static screening", () => {
  it("does not bridge mortar through hardware occupying the joint", () => {
    const metal = box("blade", 100, 100, 66, 250, 120, 3);
    metal.custom.material = "steel";
    const result = model([box("base", 100, 100, 0), box("upper", 100, 100, 70), metal]);
    expect(result.overlapPairs).toEqual([]);
    expect(result.blockedJoints).toEqual([["base", "upper"]]);
    expect(mortarPads(result)).toEqual([]);
    const simulation = new GravitySimulation(result);
    try {
      simulation.world.gravity = { x: 0, y: 0, z: 0 };
      simulation.step();
      expect(simulation.frame().maxDisplacementMm).toBeLessThan(0.01);
    } finally {
      simulation.free();
    }
  });
  it("integrates exact triangular volume and centre of mass, not bounds or vertex average", () => {
    const triangle = box("wedge", 100, 200, 0);
    triangle.custom.profileXZ = [
      { x: 0, z: 0 },
      { x: 250, z: 0 },
      { x: 0, z: 60 }
    ];
    const result = model([triangle]);
    expect(result.totalMassKg).toBeCloseTo((0.5 * 250 * 120 * 60 * 1800) / 1e9, 8);
    expect(result.bodies[0].centerMm.x).toBeCloseTo(100 + 250 / 3, 8);
    expect(result.bodies[0].centerMm.z).toBeCloseTo(20, 8);
  });
  it("traces a stack to its actual foundation and conserves the load budget", () => {
    const result = model([box("lower", 100, 100, 0), box("upper", 100, 100, 70)]);
    expect(result.foundationN).toBeCloseTo(result.totalMassKg * GRAVITY, 8);
    expect(result.unresolvedN).toBe(0);
    expect(result.bearings[1].supportIds).toEqual(["lower"]);
    expect(result.bearings[0].aboveIds).toEqual(["upper"]);
    expect(result.bearings[0].issues).toEqual([]);
    expect(result.bearings[0].loadN).toBeCloseTo(result.bearings[1].loadN * 2, 8);
    expect(mortarPads(result)).toHaveLength(2);
    expect(model([box("outside", 2200, 100, 0)]).bearings[0].issues).toContain("disconnected");
  });
  it("does not fill through-cuts, metal clearances, or unpaired exterior faces", () => {
    const cut: PlacedBrick = {
      id: "cut",
      row: 2,
      x: 0,
      y: 0,
      kind: "custom",
      orientation: "h",
      custom: {
        name: "L",
        w: 2,
        h: 120 / 125,
        solidParts: [
          { x1: 0, y1: 0, z1: 0, x2: 125, y2: 120, z2: 65 },
          { x1: 125, y1: 0, z1: 0, x2: 250, y2: 60, z2: 65 }
        ]
      }
    };
    const result = model([box("base", 0, 0, 0), cut]);
    expect(result.bodies[1].shapes.some((s) => pointInPolyhedron(s, { x: 190, y: 90, z: 95 }))).toBe(false);
    const pads = mortarPads(result);
    expect(pads).toHaveLength(4);
    expect(pads.every((pad) => pad.points.every((p) => p.z >= 65 && p.z <= 70))).toBe(true);
    expect(pads.every((pad) => !pad.points.some((p) => p.x > 125 && p.y > 60))).toBe(true);
    const metal = box("steel", 0, 0, 70);
    metal.custom.material = "steel";
    expect(mortarPads(model([box("base", 0, 0, 0), metal]))).toEqual([]);
    expect(mortarPads(model([box("single", 0, 0, 0)]))).toEqual([]);
    const simulation = new GravitySimulation(result);
    try {
      expect(simulation.bodies).toHaveLength(2);
      expect(simulation.bodies[1].mass()).toBeCloseTo(result.bodies[1].massKg, 5);
    } finally {
      simulation.free();
    }
  });
  it("distinguishes eccentric bearings, inclined contacts, and missing contacts", () => {
    const eccentric = model([box("base", 0, 0, 0, 60), box("top", 40, 0, 70)]);
    expect(eccentric.bearings[1].issues).toContain("eccentric");
    expect(eccentric.bearings[1].issues).toContain("small-bed");
    const a = box("a", 0, 0, 0, 200, 100),
      b = box("b", 0, 0, 0, 200, 100);
    a.custom.profileXZ = [
      { x: 0, z: 0 },
      { x: 200, z: 0 },
      { x: 200, z: 100 },
      { x: 0, z: 40 }
    ];
    b.custom.profileXZ = [
      { x: 0, z: 43 },
      { x: 200, z: 103 },
      { x: 200, z: 150 },
      { x: 0, z: 150 }
    ];
    const inclined = model([a, b]);
    expect(inclined.bearings[1].issues).toContain("inclined");
    expect(inclined.bearings[1].issues).not.toContain("disconnected");
    expect(inclined.foundationN + inclined.unresolvedN + inclined.heldN).toBeCloseTo(inclined.totalMassKg * GRAVITY, 6);
    expect(model([box("floating", 0, 0, 200)]).bearings[0].issues).toContain("disconnected");
  });
  it("blocks initial overlap and rejects invalid material input", () => {
    const result = model([box("a", 0, 0, 0), box("b", 10, 0, 0)]);
    expect(result.overlapPairs).toHaveLength(1);
    expect(() => new GravitySimulation(result)).toThrow("пересечения");
    expect(() => model([], { densityBrick: Number.NaN })).toThrow();
  });
});

describe("real gravity with contact physics", () => {
  it("supports a tall loaded stack without artificial energy or collapse", () => {
    const result = model(Array.from({ length: 36 }, (_, i) => box(`brick-${i}`, 100, 100, i * 70)));
    const simulation = new GravitySimulation(result);
    try {
      simulation.step(120);
      const frame = simulation.frame();
      // Bound numerical compliance per joint, not a real mortar strain criterion.
      for (let i = 1; i < result.bodies.length; i++)
        expect((frame.poses[i * 7 + 2] - frame.poses[(i - 1) * 7 + 2]) * 1000).toBeGreaterThan(69.7);
      expect(frame.maxDisplacementMm).toBeLessThan(result.bodies.length * 0.3);
      expect(frame.maxSpeedMmS).toBeLessThan(10);
      expect(frame.kineticJ).toBeLessThan(0.01);
    } finally {
      simulation.free();
    }
  });
  it("catches a falling brick on a thin elevated plate without tunnelling", () => {
    const plate = box("plate", 100, 100, 300, 250, 120, 5);
    plate.custom.material = "steel";
    const simulation = new GravitySimulation(model([plate, box("fall", 100, 100, 800)], { heldIds: ["plate"] }));
    try {
      simulation.step(120);
      expect(simulation.frame().poses[9]).toBeGreaterThan(0.33);
      expect(simulation.frame().poses[9]).toBeLessThan(0.34);
    } finally {
      simulation.free();
    }
  });
  it("uses inclined contact friction, not vertical-only support or a glued arch", () => {
    const ramp = box("ramp", 100, 100, 0, 200, 100);
    const wedge = box("wedge", 100, 100, 0, 200, 100);
    ramp.custom.profileXZ = [
      { x: 0, z: 0 },
      { x: 200, z: 0 },
      { x: 200, z: 100 },
      { x: 0, z: 40 }
    ];
    wedge.custom.profileXZ = [
      { x: 0, z: 43 },
      { x: 200, z: 103 },
      { x: 200, z: 150 },
      { x: 0, z: 150 }
    ];
    const rough = new GravitySimulation(model([ramp, wedge], { heldIds: ["ramp"], friction: 1 }));
    const smooth = new GravitySimulation(model([ramp, wedge], { heldIds: ["ramp"], friction: 0 }));
    try {
      rough.step(60);
      smooth.step(60);
      expect(rough.frame().displacementsMm[1]).toBeLessThan(1);
      expect(smooth.frame().displacementsMm[1]).toBeGreaterThan(100);
    } finally {
      rough.free();
      smooth.free();
    }
  });
  it("stops an experiment which generates unmodelled energy", () => {
    const simulation = new GravitySimulation(model([box("test", 100, 100, 1000)]));
    try {
      simulation.bodies[0].setLinvel({ x: 0, y: 0, z: 1e6 }, true);
      expect(() => simulation.step()).toThrow("баланс энергии");
    } finally {
      simulation.free();
    }
  });
  it("matches free-fall acceleration and preserves the source document", () => {
    const bricks = [box("fall", 100, 100, 1000)];
    const before = JSON.stringify(bricks),
      result = model(bricks);
    const simulation = new GravitySimulation(result);
    try {
      simulation.step(30);
      const frame = simulation.frame();
      expect(frame.time).toBeCloseTo(0.25, 7);
      expect(frame.displacementsMm[0]).toBeCloseTo(0.5 * GRAVITY * 0.25 ** 2 * 1000, -1);
      expect(frame.maxSpeedMmS).toBeCloseTo(GRAVITY * 0.25 * 1000, 0);
      expect(JSON.stringify(bricks)).toBe(before);
    } finally {
      simulation.free();
    }
  });
  it("keeps a bearing stack at rest and reports its foundation contact reaction", () => {
    const result = model([box("base", 100, 100, 0), box("top", 100, 100, 70)]);
    const simulation = new GravitySimulation(result);
    try {
      simulation.step(120);
      const frame = simulation.frame(true);
      expect(frame.maxDisplacementMm).toBeLessThan(0.6);
      expect(frame.maxSpeedMmS).toBeLessThan(2);
      expect(frame.supportReactionN).toBeCloseTo(result.totalMassKg * GRAVITY, 0);
      expect(frame.activeContacts.some((c) => c.a === "base" && c.b === "top")).toBe(true);
    } finally {
      simulation.free();
    }
  });
  it("exposes the empty-joint settlement and releases only explicit temporary constraints", () => {
    const bricks = [box("base", 100, 100, 0), box("top", 100, 100, 70)];
    const dry = new GravitySimulation(model(bricks, { joints: "dry" }));
    try {
      dry.step(120);
      expect(dry.frame().displacementsMm[1]).toBeGreaterThan(4.5);
    } finally {
      dry.free();
    }
    const simulation = new GravitySimulation(model([box("held", 100, 100, 500)], { heldIds: ["held"] }));
    try {
      simulation.step(30);
      expect(simulation.frame().maxDisplacementMm).toBeLessThan(0.001);
      simulation.releaseHeld();
      simulation.step(30);
      expect(simulation.frame().displacementsMm[0]).toBeGreaterThan(250);
      expect(simulation.frame().released).toBe(true);
    } finally {
      simulation.free();
    }
  });
});
