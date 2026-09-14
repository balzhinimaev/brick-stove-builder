import RAPIER, { type Collider, type RigidBody } from "@dimforge/rapier3d-compat";
import { massGeometry, mortarPads, vec, GRAVITY, type PhysicsModel } from "./model";
import type { Point3Mm } from "../geometry";
import { insetConvexPoints } from "./contactShape";

export const PHYSICS_DT = 1 / 120;
// Millimetre solver coordinates keep thin cut geometry above fixed hull tolerances.
const SOLVER_SCALE = 1000;
const MM_TO_SOLVER = SOLVER_SCALE / 1000;
export type PhysicsFrame = {
  time: number;
  /** Absolute translation (metres), quaternion XYZW; one entry per body. */
  poses: Float32Array;
  displacementsMm: Float32Array;
  rotationsDeg: Float32Array;
  maxDisplacementMm: number;
  maxSpeedMmS: number;
  kineticJ: number;
  mechanicalEnergyChangeJ: number;
  energyToleranceJ: number;
  moving: number;
  activeContacts: { a: string; b: string }[];
  /** Total vertical reaction of foundation + explicit holds, from momentum balance. */
  supportReactionN: number | null;
  released: boolean;
};

let initPromise: Promise<void> | undefined;
export const initPhysics = () => {
  initPromise ??= RAPIER.init();
  return initPromise;
};

/** Noncohesive rigid-contact experiment. SI inputs/outputs, millimetre internal coordinates; original document never mutated. */
export class GravitySimulation {
  readonly world: RAPIER.World;
  readonly bodies: RigidBody[] = [];
  private readonly owner = new Map<number, number>();
  private time = 0;
  private mechanicalEnergyChangeJ = 0;
  readonly energyToleranceJ: number;
  private released = false;
  private readonly reactions: number[] = [];
  constructor(
    readonly model: PhysicsModel,
    dt = PHYSICS_DT
  ) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 1 / 60) throw new Error("Недопустимый шаг расчёта");
    this.energyToleranceJ = Math.max(0.0001, model.totalMassKg * GRAVITY * 0.0005);
    if (model.overlapPairs.length)
      throw new Error("В исходной геометрии есть пересечения. Исправьте их перед запуском.");
    this.world = new RAPIER.World({ x: 0, y: 0, z: -GRAVITY * SOLVER_SCALE });
    try {
      this.world.timestep = dt;
      this.world.integrationParameters.lengthUnit = SOLVER_SCALE;
      this.world.numSolverIterations = 24;
      this.world.integrationParameters.numInternalPgsIterations = 2;
      this.world.integrationParameters.contact_natural_frequency = 240;
      this.world.integrationParameters.normalizedAllowedLinearError = 0.00005;
      this.world.integrationParameters.normalizedPredictionDistance = 0.001;
      this.world.integrationParameters.maxCcdSubsteps = 2;
      const foundation = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
      const floor = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(
          (model.grid.cols * 0.125 * SOLVER_SCALE) / 2,
          (model.grid.rows * 0.125 * SOLVER_SCALE) / 2,
          0.1 * SOLVER_SCALE
        )
          .setTranslation(
            (model.grid.cols * 0.125 * SOLVER_SCALE) / 2,
            (model.grid.rows * 0.125 * SOLVER_SCALE) / 2,
            -0.1 * SOLVER_SCALE
          )
          .setFriction(model.settings.friction)
          .setRestitution(0),
        foundation
      );
      this.owner.set(floor.handle, -1);
      const pads = model.bodies.map(() => [] as Point3Mm[][]);
      for (const pad of mortarPads(model)) pads[pad.body].push(pad.points);
      for (const [index, body] of model.bodies.entries()) {
        const descriptor = body.held ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic();
        descriptor
          .setTranslation(
            body.centerMm.x * MM_TO_SOLVER,
            body.centerMm.y * MM_TO_SOLVER,
            body.centerMm.z * MM_TO_SOLVER
          )
          .setCanSleep(false)
          .setCcdEnabled(false)
          .setSoftCcdPrediction(0.002 * SOLVER_SCALE)
          .setLinearDamping(0)
          .setAngularDamping(0);
        const rigid = this.world.createRigidBody(descriptor);
        this.bodies.push(rigid);
        const parts = body.shapes.map((shape) => ({
          ...this.collisionPart(shape.vertices, body.centerMm, shape.faces),
          volume: massGeometry(shape).volumeMm3
        }));
        const volume = parts.reduce((sum, part) => sum + part.volume, 0);
        for (const part of parts) {
          const desc = new RAPIER.ColliderDesc(part.shape)
            .setTranslation(part.position.x, part.position.y, part.position.z)
            .setMass((body.massKg * part.volume) / volume);
          this.attach(desc, rigid, index);
        }
        for (const points of pads[index]) {
          const part = this.collisionPart(points, body.centerMm);
          const desc = new RAPIER.ColliderDesc(part.shape)
            .setTranslation(part.position.x, part.position.y, part.position.z)
            .setDensity(0);
          this.attach(desc, rigid, index);
        }
      }
      // Force mass-property recomputation before release of an initially held body.
      for (const body of this.bodies) body.recomputeMassPropertiesFromColliders();
    } catch (error) {
      this.world.free();
      throw error;
    }
  }
  private collisionPart(
    points: Point3Mm[],
    origin: Point3Mm,
    faces?: number[][]
  ): { shape: RAPIER.Shape; position: Point3Mm } {
    const lo = {
      x: Math.min(...points.map((p) => p.x)),
      y: Math.min(...points.map((p) => p.y)),
      z: Math.min(...points.map((p) => p.z))
    };
    const hi = {
      x: Math.max(...points.map((p) => p.x)),
      y: Math.max(...points.map((p) => p.y)),
      z: Math.max(...points.map((p) => p.z))
    };
    const corners = new Set(
      points.map((p) =>
        (["x", "y", "z"] as const)
          .map((axis) => (Math.abs(p[axis] - lo[axis]) < 1e-5 ? "0" : Math.abs(p[axis] - hi[axis]) < 1e-5 ? "1" : "x"))
          .join("")
      )
    );
    // Exact boxes use the analytic box contact path, including thin side beds.
    // Treating these as generic hulls produces degenerate edge manifolds.
    if (corners.size === 8 && [...corners].every((key) => !key.includes("x"))) {
      return {
        shape: new RAPIER.Cuboid(
          ((hi.x - lo.x) * MM_TO_SOLVER) / 2,
          ((hi.y - lo.y) * MM_TO_SOLVER) / 2,
          ((hi.z - lo.z) * MM_TO_SOLVER) / 2
        ),
        position: vec.mul(vec.sub(vec.mul(vec.add(lo, hi), 0.5), origin), MM_TO_SOLVER)
      };
    }
    const vertices = new Float32Array(
      insetConvexPoints(points, faces).flatMap((p) => {
        const v = vec.mul(vec.sub(p, origin), MM_TO_SOLVER);
        return [v.x, v.y, v.z];
      })
    );
    const desc = RAPIER.ColliderDesc.convexHull(vertices);
    if (!desc) throw new Error("Не удалось построить физическую форму детали или шва");
    return { shape: desc.shape, position: { x: 0, y: 0, z: 0 } };
  }
  private attach(desc: RAPIER.ColliderDesc, body: RigidBody, index: number) {
    desc
      .setFriction(this.model.settings.friction)
      .setRestitution(0)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min);
    const collider = this.world.createCollider(desc, body);
    this.owner.set(collider.handle, index);
  }
  step(count = 1) {
    for (let i = 0; i < count; i++) {
      // Continuous collision detection for moving pieces, not every resting
      // thin mortar collider. This keeps fast fragments from tunnelling.
      for (const [index, body] of this.bodies.entries()) {
        const v = body.linvel(),
          w = body.angvel(),
          bounds = this.model.bodies[index].bounds;
        const radius =
          Math.hypot(bounds.hi.x - bounds.lo.x, bounds.hi.y - bounds.lo.y, bounds.hi.z - bounds.lo.z) / 2000;
        const speed = Math.hypot(v.x, v.y, v.z) / SOLVER_SCALE + radius * Math.hypot(w.x, w.y, w.z);
        body.enableCcd(speed > 0.05);
      }
      const momentum = () =>
        this.bodies.reduce((sum, b, i) => sum + (b.linvel().z / SOLVER_SCALE) * this.model.bodies[i].massKg, 0);
      const before = momentum();
      this.world.step();
      this.checkEnergy();
      this.time += this.world.timestep;
      this.reactions.push(
        this.model.totalMassKg * (-this.world.gravity.z / SOLVER_SCALE) + (momentum() - before) / this.world.timestep
      );
      if (this.reactions.length > 12) this.reactions.shift();
    }
  }
  /** With zero initial velocity, fixed supports and no motors, total mechanical
   * energy cannot grow. A 0.5 mm weight-equivalent budget tolerates contact noise;
   * exceeding it invalidates the experiment instead of displaying a false collapse. */
  private checkEnergy() {
    const g = -this.world.gravity.z / SOLVER_SCALE;
    let change = 0;
    for (const [i, body] of this.bodies.entries()) {
      const b = this.model.bodies[i],
        p = body.translation(),
        v = body.linvel(),
        w = body.angvel();
      const inertia = body.effectiveAngularInertia();
      const rotational =
        (0.5 *
          (inertia.m11 * w.x * w.x +
            inertia.m22 * w.y * w.y +
            inertia.m33 * w.z * w.z +
            2 * (inertia.m12 * w.x * w.y + inertia.m13 * w.x * w.z + inertia.m23 * w.y * w.z))) /
        SOLVER_SCALE ** 2;
      change +=
        (0.5 * b.massKg * (v.x * v.x + v.y * v.y + v.z * v.z)) / SOLVER_SCALE ** 2 +
        rotational +
        b.massKg * g * (p.z / SOLVER_SCALE - b.centerMm.z / 1000);
    }
    this.mechanicalEnergyChangeJ = change;
    if (!Number.isFinite(change) || change > this.energyToleranceJ) {
      throw new Error(
        "Расчёт остановлен: нарушен численный баланс энергии. Последующие движения недостоверны. Сбросьте эксперимент; это не вывод об обрушении печи."
      );
    }
  }
  setGravity(acceleration: number) {
    this.world.gravity = { x: 0, y: 0, z: -acceleration * SOLVER_SCALE };
  }
  releaseHeld() {
    for (const [i, body] of this.bodies.entries()) {
      if (this.model.bodies[i].held) body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      body.wakeUp();
    }
    this.released = true;
  }
  frame(includeContacts = false): PhysicsFrame {
    const poses = new Float32Array(this.bodies.length * 7);
    const displacementsMm = new Float32Array(this.bodies.length);
    const rotationsDeg = new Float32Array(this.bodies.length);
    let maxDisplacementMm = 0,
      maxSpeedMmS = 0,
      kineticJ = 0,
      moving = 0;
    for (const [i, body] of this.bodies.entries()) {
      const p = body.translation(),
        q = body.rotation(),
        velocity = body.linvel(),
        angular = body.angvel();
      if (![p.x, p.y, p.z, q.x, q.y, q.z, q.w].every(Number.isFinite))
        throw new Error("Расчёт потерял численную устойчивость. Сбросьте симуляцию.");
      poses.set([p.x / SOLVER_SCALE, p.y / SOLVER_SCALE, p.z / SOLVER_SCALE, q.x, q.y, q.z, q.w], i * 7);
      const delta = vec.sub(vec.mul(p, 1000 / SOLVER_SCALE), this.model.bodies[i].centerMm);
      const displacement = Math.hypot(delta.x, delta.y, delta.z);
      const speed = (Math.hypot(velocity.x, velocity.y, velocity.z) * 1000) / SOLVER_SCALE;
      const angleSpeed = Math.hypot(angular.x, angular.y, angular.z);
      displacementsMm[i] = displacement;
      rotationsDeg[i] = (2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180) / Math.PI;
      maxDisplacementMm = Math.max(maxDisplacementMm, displacement);
      maxSpeedMmS = Math.max(maxSpeedMmS, speed);
      // Translational energy only; do not label this total kinetic energy in UI.
      kineticJ += 0.5 * this.model.bodies[i].massKg * (speed / 1000) ** 2;
      if (speed > 1 || angleSpeed > 0.01) moving++;
    }
    const contacts = new Map<string, { a: string; b: string }>();
    if (includeContacts)
      this.world.forEachCollider((a: Collider) => {
        this.world.contactPairsWith(a, (b: Collider) => {
          if (a.handle >= b.handle) return;
          const ai = this.owner.get(a.handle),
            bi = this.owner.get(b.handle);
          if (ai === undefined || bi === undefined || ai === bi) return;
          this.world.contactPair(a, b, (manifold) => {
            if (!manifold.numSolverContacts()) return;
            const ia = ai < 0 ? "foundation" : this.model.bodies[ai].id;
            const ib = bi < 0 ? "foundation" : this.model.bodies[bi].id;
            const [first, second] = [ia, ib].sort();
            const key = JSON.stringify([first, second]);
            contacts.set(key, { a: first, b: second });
          });
        });
      });
    return {
      time: this.time,
      poses,
      displacementsMm,
      rotationsDeg,
      maxDisplacementMm,
      maxSpeedMmS,
      kineticJ,
      mechanicalEnergyChangeJ: this.mechanicalEnergyChangeJ,
      energyToleranceJ: this.energyToleranceJ,
      moving,
      activeContacts: [...contacts.values()],
      supportReactionN: this.reactions.length
        ? this.reactions.reduce((s, v) => s + v, 0) / this.reactions.length
        : null,
      released: this.released
    };
  }
  free() {
    this.world.free();
  }
}
