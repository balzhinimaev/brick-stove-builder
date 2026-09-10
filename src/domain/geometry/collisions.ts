import type { BrickFootprint, PlacedBrick } from "../types";
import { MM_PER_CELL } from "../constants";
import { damperParts, grateParts } from "./hardware";
import {
  convexIntersects,
  pointInPolyhedron,
  profilePolyhedron,
  translatedPolyhedron,
  type ConvexPolyhedron,
  type Point3Mm
} from "./convex";
import { brickBounds, brickBoxes, notchBox, type BrickBox } from "./bounds";

export const GEOMETRY_EPS = 1e-6;

export function boxesIntersect(a: BrickBox, b: BrickBox): boolean {
  return (
    Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) > GEOMETRY_EPS &&
    Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) > GEOMETRY_EPS
  );
}

/**
 * Overlap over occupied boxes. O(boxes²) per pair (≤2×2) and, unlike a
 * cell-occupancy Set, it stays correct for half-cell `trim`/`cut` footprints
 * and L-shaped rebate bricks.
 */
export function overlaps(a: BrickFootprint, b: BrickFootprint): boolean {
  const aBoxes = brickBoxes(a);
  const bBoxes = brickBoxes(b);
  return aBoxes.some((ab) => bBoxes.some((bb) => boxesIntersect(ab, bb)));
}

/**
 * Накладные элементы: лежат ПОВЕРХ ряда и с кирпичами не конфликтуют.
 * Плита — на кладке; задвижка — в шве над рядом (рамка закладывается между
 * рядами, следующий ряд ложится сверху).
 */
export function isOverlayKind(kind: BrickFootprint["kind"]): boolean {
  return kind === "plate" || kind === "damper";
}

/**
 * Накладной ли КОНКРЕТНЫЙ элемент: плита в режиме «заподлицо» (flush) утоплена
 * в ряд, участвует в честных 3D-коллизиях и ложится в вырезы кирпичей;
 * задвижка накладная всегда.
 */
export function isOverlayBrick(brick: BrickFootprint): boolean {
  if (brick.kind === "damper") return brick.custom?.damperPlane !== "vertical";
  return brick.kind === "plate" && brick.custom?.flush !== true;
}

/** Ряд кладки: кирпич на плашку 65 мм + шов ≈ 70 мм. */
export const COURSE_MM = 70;
export const BRICK_MM = 65;
/** Толщина колосниковой решётки; лежит заподлицо с верхом ряда. */
const GRATE_THICKNESS_MM = 22;
/** Толщина варочной плиты по умолчанию. */
const PLATE_THICKNESS_MM = 14;
/** Высота рамки задвижки в шве (см. DAMPER_THICKNESS_MM в editor.ts). */
const DAMPER_MM = 20;
/** Подрезка колосникового узла лежит на посадочной полке — верхняя половина. */
const TRIM_SEAT_MM = BRICK_MM / 2;

/** box/z1/z2 are bounds only when polyhedron is present. Use solidsIntersect3D for physical tests. */
export type BrickSolid = { box: BrickBox; z1: number; z2: number; polyhedron?: ConvexPolyhedron };

/** A through-cut stays empty even if an older document also stores a shallow depth. */
export function notchDepthMm(brick: BrickFootprint): number {
  if (brick.custom?.ledge === false) return BRICK_MM;
  return Math.min(BRICK_MM, Math.max(0, brick.custom?.notchDepthMm ?? BRICK_MM / 2));
}

/**
 * Занятые объёмы элемента: плановые боксы + вертикальный интервал в мм
 * ОТ НИЗА СВОЕГО РЯДА. Это и есть «честная» высота: колосник — только верхние
 * 22 мм, дверца — вверх на всю высоту проёма (через ряды), полка выреза —
 * снизу до (65 − глубина реза), над ней свободно.
 */
export function brickSolids(brick: BrickFootprint): BrickSolid[] {
  const bounds = brickBounds(brick);
  const polyhedron = profilePolyhedron(brick);
  if (polyhedron)
    return [
      {
        box: bounds,
        z1: Math.min(...polyhedron.vertices.map((p) => p.z)),
        z2: Math.max(...polyhedron.vertices.map((p) => p.z)),
        polyhedron
      }
    ];
  if (brick.kind === "plate") {
    const t = brick.custom?.thicknessMm ?? PLATE_THICKNESS_MM;
    if (brick.custom?.flush === true) {
      // в вырезы: низ плиты — на посадке, вычисленной при установке из полок
      // под следом (plateSeatZ); без полок — верх заподлицо с верхом ряда
      const seat = brick.custom?.seatZMm ?? BRICK_MM - t;
      return [{ box: bounds, z1: seat, z2: seat + t }];
    }
    // поверх: лежит на ряду
    return [{ box: bounds, z1: BRICK_MM, z2: BRICK_MM + t }];
  }
  if (brick.kind === "damper") {
    if (brick.custom?.damperPlane === "vertical") {
      const seat = brick.custom.seatZMm ?? 0;
      const height = brick.custom.heightMm ?? BRICK_MM;
      return [{ box: bounds, z1: seat, z2: seat + height }];
    }
    // рамка в шве над своим рядом: конфликтует только с другими накладными
    const t = brick.custom?.thicknessMm ?? DAMPER_MM;
    const seat = brick.custom?.seatZMm ?? BRICK_MM;
    return [{ box: bounds, z1: seat, z2: seat + t }];
  }
  if (brick.kind === "grate") {
    // как flush-плита: лежит на посадке из полок (автоподрез при установке);
    // без полок — верх заподлицо с верхом ряда
    const t = brick.custom?.thicknessMm ?? GRATE_THICKNESS_MM;
    const seat = brick.custom?.seatZMm ?? BRICK_MM - t;
    return [{ box: bounds, z1: seat, z2: seat + t }];
  }
  if (brick.kind === "cleanout") return [{ box: bounds, z1: 0, z2: brick.custom?.heightMm ?? BRICK_MM }];
  if (brick.kind === "trim") return [{ box: bounds, z1: TRIM_SEAT_MM, z2: BRICK_MM }];

  const notch = notchBox(brick);
  if (!notch) return [{ box: bounds, z1: 0, z2: BRICK_MM }];
  const depthMm = notchDepthMm(brick);
  const solids: BrickSolid[] = brickBoxes(brick).map((box) => ({ box, z1: 0, z2: BRICK_MM }));
  const ledgeTop = Math.max(0, BRICK_MM - depthMm);
  if (ledgeTop > 0) solids.push({ box: notch, z1: 0, z2: ledgeTop });
  return solids;
}

/** Canonical convex solid in millimetres, with an optional absolute course elevation. */
export function solidPolyhedron(solid: BrickSolid, baseMm = 0): ConvexPolyhedron {
  if (solid.polyhedron) return translatedPolyhedron(solid.polyhedron, baseMm);
  const { box, z1, z2 } = solid;
  const vertices = [z1, z2].flatMap((z) => [
    { x: box.x1 * MM_PER_CELL, y: box.y1 * MM_PER_CELL, z: z + baseMm },
    { x: box.x2 * MM_PER_CELL, y: box.y1 * MM_PER_CELL, z: z + baseMm },
    { x: box.x2 * MM_PER_CELL, y: box.y2 * MM_PER_CELL, z: z + baseMm },
    { x: box.x1 * MM_PER_CELL, y: box.y2 * MM_PER_CELL, z: z + baseMm }
  ]);
  return {
    vertices,
    faces: [
      [0, 3, 2, 1],
      [4, 5, 6, 7],
      [0, 1, 5, 4],
      [1, 2, 6, 5],
      [2, 3, 7, 6],
      [3, 0, 4, 7]
    ]
  };
}

export function solidsIntersect3D(a: BrickSolid, b: BrickSolid, aBaseMm = 0, bBaseMm = 0): boolean {
  if (
    !boxesIntersect(a.box, b.box) ||
    Math.min(aBaseMm + a.z2, bBaseMm + b.z2) - Math.max(aBaseMm + a.z1, bBaseMm + b.z1) <= GEOMETRY_EPS
  )
    return false;
  if (!a.polyhedron && !b.polyhedron) return true;
  return convexIntersects(solidPolyhedron(a, aBaseMm), solidPolyhedron(b, bBaseMm));
}

export function pointInSolid(solid: BrickSolid, pointMm: Point3Mm, baseMm = 0, toleranceMm = GEOMETRY_EPS): boolean {
  if (!solid.polyhedron)
    return (
      pointMm.x >= solid.box.x1 * MM_PER_CELL - toleranceMm &&
      pointMm.x <= solid.box.x2 * MM_PER_CELL + toleranceMm &&
      pointMm.y >= solid.box.y1 * MM_PER_CELL - toleranceMm &&
      pointMm.y <= solid.box.y2 * MM_PER_CELL + toleranceMm &&
      pointMm.z >= baseMm + solid.z1 - toleranceMm &&
      pointMm.z <= baseMm + solid.z2 + toleranceMm
    );
  return pointInPolyhedron(solidPolyhedron(solid, baseMm), pointMm, toleranceMm);
}

/** Actual occupied geometry, including moving blades, their retained frames and grate slots.
 * brickSolids deliberately remains the backwards-compatible mounting envelope used by editor placement.
 */
export function brickPhysicalSolids(brick: BrickFootprint & Partial<Pick<PlacedBrick, "damperOpen">>): BrickSolid[] {
  if (brick.kind === "vent") return [];
  if (brick.kind === "damper") return damperParts(brick).map((part) => part.solid);
  if (brick.kind === "grate") return grateParts(brick).map((part) => part.solid);
  return brickSolids(brick);
}

/** Physical audit API. Deliberately has no editor overlay exemption. */
export function brickPhysicalOverlap(a: PlacedBrick, b: PlacedBrick): boolean {
  const aBase = (a.row - 1) * COURSE_MM;
  const bBase = (b.row - 1) * COURSE_MM;
  return brickPhysicalSolids(a).some((sa) =>
    brickPhysicalSolids(b).some((sb) => solidsIntersect3D(sa, sb, aBase, bBase))
  );
}

export function overlaps3D(a: PlacedBrick, b: PlacedBrick): boolean {
  if (isOverlayBrick(a) !== isOverlayBrick(b)) return false;
  const aBase = (a.row - 1) * COURSE_MM;
  const bBase = (b.row - 1) * COURSE_MM;
  return brickSolids(a).some((sa) => brickSolids(b).some((sb) => solidsIntersect3D(sa, sb, aBase, bBase)));
}
