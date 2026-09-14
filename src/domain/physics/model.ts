import {
  brickPhysicalSolids,
  convexFaceContacts,
  convexIntersects,
  polyhedronFaces,
  solidPolyhedron,
  type ConvexPolyhedron,
  type FaceContact,
  type Point3Mm
} from "../geometry";
import { isSteelPart } from "../materials";
import type { GridSpec, PlacedBrick } from "../types";

export type PhysicsSettings = {
  densityBrick: number;
  densityFirebrick: number;
  densityMetal: number;
  friction: number;
  jointMm: number;
  joints: "paired" | "dry";
  throughRow: number;
  heldIds: string[];
};
export const DEFAULT_PHYSICS: PhysicsSettings = {
  densityBrick: 1800,
  densityFirebrick: 2000,
  densityMetal: 7850,
  friction: 0.6,
  jointMm: 5,
  joints: "paired",
  throughRow: 999,
  heldIds: []
};
export const GRAVITY = 9.81;
export const vec = {
  add: (a: Point3Mm, b: Point3Mm): Point3Mm => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
  sub: (a: Point3Mm, b: Point3Mm): Point3Mm => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
  mul: (a: Point3Mm, k: number): Point3Mm => ({ x: a.x * k, y: a.y * k, z: a.z * k }),
  dot: (a: Point3Mm, b: Point3Mm) => a.x * b.x + a.y * b.y + a.z * b.z,
  cross: (a: Point3Mm, b: Point3Mm): Point3Mm => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  })
};
const zero = (): Point3Mm => ({ x: 0, y: 0, z: 0 });
type Bounds = { lo: Point3Mm; hi: Point3Mm };
export type PhysicsBody = {
  id: string;
  row: number;
  name: string;
  material: "brick" | "firebrick" | "metal";
  shapes: ConvexPolyhedron[];
  massKg: number;
  centerMm: Point3Mm;
  bounds: Bounds;
  held: boolean;
};
export type PhysicsContact = FaceContact & { a: number; b: number; mortar: boolean; partA?: number; partB?: number };
export type BearingIssue =
  | "disconnected"
  | "inclined"
  | "no-bed"
  | "eccentric"
  | "small-bed"
  | "overlap"
  | "blocked-joint";
export type Bearing = {
  id: string;
  massKg: number;
  loadN: number;
  bedMm2: number;
  estimatedPressureMPa: number | null;
  supportIds: string[];
  aboveIds: string[];
  contactIds: string[];
  issues: BearingIssue[];
};
export type PhysicsModel = {
  settings: PhysicsSettings;
  grid: GridSpec;
  bodies: PhysicsBody[];
  contacts: PhysicsContact[];
  bearings: Bearing[];
  totalMassKg: number;
  foundationN: number;
  heldN: number;
  unresolvedN: number;
  overlapPairs: [string, string][];
  blockedJoints: [string, string][];
};

/** Exact tetrahedral first moments, using a nearby origin to avoid cancellation. */
export function massGeometry(shape: ConvexPolyhedron): { volumeMm3: number; centerMm: Point3Mm } {
  const origin = shape.vertices.reduce((s, p) => vec.add(s, vec.mul(p, 1 / shape.vertices.length)), zero());
  let volume = 0;
  let moment = zero();
  for (const face of polyhedronFaces(shape)) {
    const a = vec.sub(face.vertices[0], origin);
    for (let i = 1; i + 1 < face.vertices.length; i++) {
      const b = vec.sub(face.vertices[i], origin),
        c = vec.sub(face.vertices[i + 1], origin);
      const v = Math.abs(vec.dot(a, vec.cross(b, c))) / 6;
      volume += v;
      moment = vec.add(moment, vec.mul(vec.add(vec.add(a, b), c), v / 4));
    }
  }
  if (!(volume > 1e-6)) throw new Error("Нулевой объём физической детали");
  return { volumeMm3: volume, centerMm: vec.add(origin, vec.mul(moment, 1 / volume)) };
}
function boundsOf(shapes: ConvexPolyhedron[]): Bounds {
  const points = shapes.flatMap((s) => s.vertices);
  const get = (fn: (...values: number[]) => number) => ({
    x: fn(...points.map((p) => p.x)),
    y: fn(...points.map((p) => p.y)),
    z: fn(...points.map((p) => p.z))
  });
  return { lo: get(Math.min), hi: get(Math.max) };
}
function nearby(a: Bounds, b: Bounds, gap: number): boolean {
  return (["x", "y", "z"] as const).every((k) => Math.max(a.lo[k], b.lo[k]) - Math.min(a.hi[k], b.hi[k]) <= gap + 1e-5);
}
function cross2(a: Point3Mm, b: Point3Mm, c: Point3Mm) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
/** Support hull is a screening tool for horizontal bearings, not an arch criterion. */
function inHull(points: Point3Mm[], p: Point3Mm): boolean {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const chain = (list: Point3Mm[]) => {
    const result: Point3Mm[] = [];
    for (const v of list) {
      while (result.length > 1 && cross2(result[result.length - 2], result[result.length - 1], v) <= 0) result.pop();
      result.push(v);
    }
    return result.slice(0, -1);
  };
  const hull = [...chain(sorted), ...chain(sorted.reverse())];
  return hull.length >= 3 && hull.every((v, i) => cross2(v, hull[(i + 1) % hull.length], p) >= -1e-3);
}
function validateSettings(s: PhysicsSettings) {
  if (
    [s.densityBrick, s.densityFirebrick, s.densityMetal].some((v) => !Number.isFinite(v) || v < 100 || v > 30000) ||
    !Number.isFinite(s.friction) ||
    s.friction < 0 ||
    s.friction > 1.5 ||
    !Number.isFinite(s.jointMm) ||
    s.jointMm < 0 ||
    s.jointMm > 10 ||
    !Number.isInteger(s.throughRow) ||
    s.throughRow < 1 ||
    !["paired", "dry"].includes(s.joints)
  ) {
    throw new Error("Проверьте плотность, трение, толщину шва и номер ряда");
  }
}

export function buildPhysicsModel(bricks: PlacedBrick[], grid: GridSpec, settings: PhysicsSettings): PhysicsModel {
  validateSettings(settings);
  const bodies: PhysicsBody[] = [];
  for (const brick of bricks.filter((b) => b.row <= settings.throughRow && b.kind !== "vent")) {
    const shapes = brickPhysicalSolids(brick).map((s) => solidPolyhedron(s, (brick.row - 1) * 70));
    if (!shapes.length) continue;
    const material =
      isSteelPart(brick) || ["plate", "grate", "cleanout", "damper"].includes(brick.kind)
        ? "metal"
        : brick.kind === "firebrick" || brick.custom?.cutFrom === "firebrick"
          ? "firebrick"
          : "brick";
    const density =
      material === "metal"
        ? settings.densityMetal
        : material === "firebrick"
          ? settings.densityFirebrick
          : settings.densityBrick;
    const parts = shapes.map(massGeometry);
    const volume = parts.reduce((sum, p) => sum + p.volumeMm3, 0);
    const centerMm = parts.reduce((sum, p) => vec.add(sum, vec.mul(p.centerMm, p.volumeMm3 / volume)), zero());
    bodies.push({
      id: brick.id,
      row: brick.row,
      name: brick.custom?.name ?? brick.id,
      material,
      shapes,
      massKg: (volume * density) / 1e9,
      centerMm,
      bounds: boundsOf(shapes),
      held: settings.heldIds.includes(brick.id)
    });
  }
  const ids = new Set(bodies.map((b) => b.id));
  if (ids.size !== bodies.length) throw new Error("Повторяются номера деталей");
  let contacts: PhysicsContact[] = [];
  const overlapPairs: [string, string][] = [];
  const solidBounds = bodies.map((b) => b.shapes.map((s) => boundsOf([s])));
  // Sweep-and-prune; narrow phase uses actual convex faces, never only boxes.
  const order = bodies.map((_, i) => i).sort((a, b) => bodies[a].bounds.lo.z - bodies[b].bounds.lo.z);
  for (let ai = 0; ai < order.length; ai++) {
    const a = order[ai],
      ba = bodies[a];
    for (let bi = ai + 1; bi < order.length; bi++) {
      const b = order[bi],
        bb = bodies[b];
      if (bb.bounds.lo.z > ba.bounds.hi.z + settings.jointMm + 0.01) break;
      const mortar = settings.joints === "paired" && ba.material !== "metal" && bb.material !== "metal";
      const gap = mortar ? settings.jointMm : 0.01;
      if (!nearby(ba.bounds, bb.bounds, gap)) continue;
      let overlap = false;
      ba.shapes.forEach((sa, ia) => {
        bb.shapes.forEach((sb, ib) => {
          if (!nearby(solidBounds[a][ia], solidBounds[b][ib], gap)) return;
          if (nearby(solidBounds[a][ia], solidBounds[b][ib], -0.01) && convexIntersects(sa, sb, 0.01)) overlap = true;
          for (const c of convexFaceContacts(sa, sb, gap, mortar ? 0.02 : 0)) {
            if (c.areaMm2 >= 1) contacts.push({ ...c, a, b, mortar, partA: ia, partB: ib });
          }
        });
      });
      if (overlap) overlapPairs.push([ba.id, bb.id]);
    }
  }
  // Do not bridge through a blade, seat or third physical cut in a masonry gap.
  // Omit obstructed patches conservatively until the joint is detailed explicitly.
  const slices = new Map<number, Set<number>>();
  bodies.forEach((body, i) => {
    for (let z = Math.floor(body.bounds.lo.z / 70); z <= Math.floor(body.bounds.hi.z / 70); z++) {
      if (!slices.has(z)) slices.set(z, new Set());
      slices.get(z)?.add(i);
    }
  });
  const blockedJoints: [string, string][] = [];
  contacts = contacts.filter((c) => {
    if (
      !c.mortar ||
      Math.max(...c.polygonMm.map((p, i) => Math.hypot(...Object.values(vec.sub(c.opposingPolygonMm[i], p))))) < 0.02
    )
      return true;
    const shape = jointBridge(c),
      bounds = boundsOf([shape]);
    const candidates = new Set<number>();
    for (let z = Math.floor(bounds.lo.z / 70); z <= Math.floor(bounds.hi.z / 70); z++)
      for (const i of slices.get(z) ?? []) candidates.add(i);
    for (const i of candidates) {
      if (!nearby(bounds, bodies[i].bounds, -0.001)) continue;
      if (
        bodies[i].shapes.some(
          (s, k) =>
            !(i === c.a && k === c.partA) &&
            !(i === c.b && k === c.partB) &&
            nearby(bounds, solidBounds[i][k], -0.001) &&
            convexIntersects(shape, s, 0.001)
        )
      ) {
        blockedJoints.push([bodies[c.a].id, bodies[c.b].id]);
        return false;
      }
    }
    return true;
  });
  // Actual foundation footprint: an overhanging first row is NOT automatically fixed.
  const foundation: ConvexPolyhedron = solidPolyhedron({
    box: { x1: 0, y1: 0, x2: grid.cols, y2: grid.rows },
    z1: -200,
    z2: 0
  });
  bodies.forEach((body, a) => {
    if (body.bounds.lo.z < -0.01) overlapPairs.push([body.id, "foundation"]);
    if (body.bounds.lo.z > 0.01) return;
    for (const shape of body.shapes) {
      for (const c of convexFaceContacts(shape, foundation, 0.01))
        if (c.areaMm2 >= 1) contacts.push({ ...c, a, b: -1, mortar: false });
    }
  });
  const adjacency = bodies.map(() => new Set<number>());
  const grounded = new Set<number>(bodies.flatMap((b, i) => (b.held ? [i] : [])));
  for (const c of contacts) {
    if (c.b < 0) grounded.add(c.a);
    else {
      adjacency[c.a].add(c.b);
      adjacency[c.b].add(c.a);
    }
  }
  const queue = [...grounded];
  for (let i = 0; i < queue.length; i++)
    for (const b of adjacency[queue[i]])
      if (!grounded.has(b)) {
        grounded.add(b);
        queue.push(b);
      }
  const bearings: Bearing[] = bodies.map((b) => ({
    id: b.id,
    massKg: b.massKg,
    loadN: b.massKg * GRAVITY,
    bedMm2: 0,
    estimatedPressureMPa: null,
    supportIds: [],
    aboveIds: [],
    contactIds: [],
    issues: []
  }));
  const down = bodies.map(() => [] as { lower: number; c: PhysicsContact }[]);
  const inclined = new Set<number>();
  for (const c of contacts) {
    if (c.b >= 0) {
      bearings[c.a].contactIds.push(bodies[c.b].id);
      bearings[c.b].contactIds.push(bodies[c.a].id);
      if (Math.abs(c.normalA.z) > 0.01 && Math.abs(c.normalA.z) < 0.999) {
        inclined.add(c.a);
        inclined.add(c.b);
      }
    }
    const upper = c.normalA.z < -0.999 ? c.a : c.normalA.z > 0.999 ? c.b : -1;
    const lower = upper === c.a ? c.b : c.a;
    if (upper < 0 || (lower >= 0 && bodies[lower].centerMm.z >= bodies[upper].centerMm.z)) continue;
    down[upper].push({ lower, c });
    bearings[upper].bedMm2 += c.areaMm2;
    bearings[upper].supportIds.push(lower < 0 ? "foundation" : bodies[lower].id);
    if (lower >= 0) bearings[lower].aboveIds.push(bodies[upper].id);
  }
  const moments = bodies.map((b) => vec.mul(b.centerMm, b.massKg * GRAVITY));
  let foundationN = 0,
    heldN = 0,
    unresolvedN = 0;
  for (const i of [...order].sort((a, b) => bodies[b].centerMm.z - bodies[a].centerMm.z)) {
    const b = bodies[i],
      r = bearings[i];
    if (!grounded.has(i)) r.issues.push("disconnected");
    if (overlapPairs.some((pair) => pair.includes(b.id))) r.issues.push("overlap");
    if (blockedJoints.some((pair) => pair.includes(b.id))) r.issues.push("blocked-joint");
    if (inclined.has(i)) r.issues.push("inclined");
    if (b.held) {
      heldN += r.loadN;
      continue;
    }
    if (inclined.has(i) || !down[i].length) {
      unresolvedN += r.loadN;
      if (!inclined.has(i) && !r.issues.includes("disconnected")) r.issues.push("no-bed");
      continue;
    }
    const resultant = vec.mul(moments[i], 1 / r.loadN);
    if (
      !inHull(
        down[i].flatMap(({ c }) => c.polygonMm),
        resultant
      )
    )
      r.issues.push("eccentric");
    const footprint = (b.bounds.hi.x - b.bounds.lo.x) * (b.bounds.hi.y - b.bounds.lo.y);
    if (r.bedMm2 < footprint * 0.3) r.issues.push("small-bed");
    r.estimatedPressureMPa = r.loadN / r.bedMm2;
    // Explicit area-weighted screening, not a solution for stiffness/moments.
    for (const { lower, c } of down[i]) {
      const force = (r.loadN * c.areaMm2) / r.bedMm2;
      if (lower < 0) foundationN += force;
      else {
        bearings[lower].loadN += force;
        const at = c.polygonMm.reduce((s, p) => vec.add(s, vec.mul(p, 1 / c.polygonMm.length)), zero());
        moments[lower] = vec.add(moments[lower], vec.mul(at, force));
      }
    }
  }
  for (const r of bearings) {
    r.supportIds = [...new Set(r.supportIds)];
    r.aboveIds = [...new Set(r.aboveIds)];
    r.contactIds = [...new Set(r.contactIds)];
  }
  return {
    settings: { ...settings, heldIds: [...settings.heldIds] },
    grid: { ...grid },
    bodies,
    contacts,
    bearings,
    totalMassKg: bodies.reduce((s, b) => s + b.massKg, 0),
    foundationN,
    heldN,
    unresolvedN,
    overlapPairs,
    blockedJoints
  };
}

function jointBridge(c: FaceContact): ConvexPolyhedron {
  const vertices = [...c.polygonMm, ...c.opposingPolygonMm];
  const count = c.polygonMm.length;
  const rings = [Array.from({ length: count }, (_, i) => i), Array.from({ length: count }, (_, i) => count + i)];
  for (let i = 0; i < count; i++) rings.push([i, (i + 1) % count, ((i + 1) % count) + count, i + count]);
  const faces: number[][] = [];
  for (const ring of rings)
    for (let i = 1; i + 1 < ring.length; i++) {
      const triangle = [ring[0], ring[i], ring[i + 1]];
      const normal = vec.cross(
        vec.sub(vertices[triangle[1]], vertices[triangle[0]]),
        vec.sub(vertices[triangle[2]], vertices[triangle[0]])
      );
      if (Math.hypot(normal.x, normal.y, normal.z) > 1e-8) faces.push(triangle);
    }
  return { vertices, faces };
}

/** Paired half-beds only. No inflation of flues, clearances or exterior faces.
 * Bed geometry carries no extra mass: mortar mass is explicitly excluded. */
export function mortarPads(model: PhysicsModel): { body: number; points: Point3Mm[] }[] {
  return model.contacts.flatMap((c) => {
    if (!c.mortar || c.b < 0) return [];
    const gaps = c.polygonMm.map((p, i) => Math.hypot(...Object.values(vec.sub(c.opposingPolygonMm[i], p))));
    if (Math.max(...gaps) < 0.02) return [];
    const mid = c.polygonMm.map((p, i) => vec.mul(vec.add(p, c.opposingPolygonMm[i]), 0.5));
    return [
      { body: c.a, points: [...c.polygonMm, ...mid] },
      { body: c.b, points: [...mid, ...c.opposingPolygonMm] }
    ];
  });
}
