import { it, expect } from "vitest";
import { gridFromParameters } from "../geometry";
import { HOUSE_RUSSIAN_STOVE_R2 as R2 } from "../houseRussianStove";
import { buildPhysicsModel, DEFAULT_PHYSICS, GRAVITY } from "../physics/model";
import { GravitySimulation, initPhysics } from "../physics/simulation";

it("preserves R2, has no artificial zero-gravity explosion, and runs loaded masonry", async () => {
  await initPhysics();
  const bricks = Object.values(R2.rows).flat();
  const original = JSON.stringify(bricks);
  const start = performance.now();
  const result = buildPhysicsModel(bricks, gridFromParameters(R2.parameters), DEFAULT_PHYSICS);
  expect(result.bodies.length).toBe(bricks.filter((b) => b.kind !== "vent").length);
  expect(result.overlapPairs).toEqual([]);
  expect(result.blockedJoints.length).toBeGreaterThan(0);
  expect(result.foundationN + result.heldN + result.unresolvedN).toBeCloseTo(result.totalMassKg * GRAVITY, 5);
  expect(result.bodies.every((b) => Number.isFinite(b.massKg) && b.massKg > 0)).toBe(true);
  const simulation = new GravitySimulation(result);
  try {
    simulation.world.gravity = { x: 0, y: 0, z: 0 };
    simulation.step(3);
    expect(simulation.frame().maxDisplacementMm).toBeLessThan(0.05);
    simulation.setGravity(GRAVITY);
    const started = performance.now();
    simulation.step(36);
    const frame = simulation.frame(true);
    expect(frame.poses.every(Number.isFinite)).toBe(true);
    expect(frame.mechanicalEnergyChangeJ).toBeLessThan(frame.energyToleranceJ);
    expect(frame.time).toBeGreaterThan(0.3);
    expect(simulation.bodies.reduce((s, b) => s + b.mass(), 0)).toBeCloseTo(result.totalMassKg, 1);
    console.info(
      JSON.stringify({
        bodies: result.bodies.length,
        contacts: result.contacts.length,
        blockedJoints: result.blockedJoints.length,
        massKg: result.totalMassKg,
        initMs: Math.round(started - start),
        loadedRunMs: Math.round(performance.now() - started),
        maxDisplacementMm: frame.maxDisplacementMm,
        maxSpeedMmS: frame.maxSpeedMmS,
        moving: frame.moving,
        kineticJ: frame.kineticJ,
        energyChangeJ: frame.mechanicalEnergyChangeJ,
        potentialChangeJ: result.bodies.reduce(
          (sum, b, i) => sum + b.massKg * GRAVITY * (frame.poses[i * 7 + 2] - b.centerMm.z / 1000),
          0
        ),
        disconnected: result.bearings.filter((b) => b.issues.includes("disconnected")).length
      })
    );
  } finally {
    simulation.free();
  }
  expect(JSON.stringify(bricks)).toBe(original);
}, 180000);
