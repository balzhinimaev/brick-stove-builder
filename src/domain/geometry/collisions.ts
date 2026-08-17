import type { BrickFootprint, PlacedBrick } from "../types";
import { brickBounds, brickBoxes, notchBox, type BrickBox } from "./bounds";

function boxesIntersect(a: BrickBox, b: BrickBox): boolean {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
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
  if (brick.kind === "damper") return true;
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

export type BrickSolid = { box: BrickBox; z1: number; z2: number };

/**
 * Занятые объёмы элемента: плановые боксы + вертикальный интервал в мм
 * ОТ НИЗА СВОЕГО РЯДА. Это и есть «честная» высота: колосник — только верхние
 * 22 мм, дверца — вверх на всю высоту проёма (через ряды), полка выреза —
 * снизу до (65 − глубина реза), над ней свободно.
 */
export function brickSolids(brick: BrickFootprint): BrickSolid[] {
  const bounds = brickBounds(brick);
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
    // рамка в шве над своим рядом: конфликтует только с другими накладными
    const t = brick.custom?.thicknessMm ?? DAMPER_MM;
    return [{ box: bounds, z1: BRICK_MM, z2: BRICK_MM + t }];
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
  const depthMm = brick.custom?.notchDepthMm ?? (brick.custom?.ledge === false ? BRICK_MM : BRICK_MM / 2);
  const solids: BrickSolid[] = brickBoxes(brick).map((box) => ({ box, z1: 0, z2: BRICK_MM }));
  const ledgeTop = Math.max(0, BRICK_MM - depthMm);
  if (ledgeTop > 0) solids.push({ box: notch, z1: 0, z2: ledgeTop });
  return solids;
}


export function overlaps3D(a: PlacedBrick, b: PlacedBrick): boolean {
  if (isOverlayBrick(a) !== isOverlayBrick(b)) return false;
  const aBase = (a.row - 1) * COURSE_MM;
  const bBase = (b.row - 1) * COURSE_MM;
  return brickSolids(a).some((sa) =>
    brickSolids(b).some(
      (sb) =>
        boxesIntersect(sa.box, sb.box) &&
        aBase + sa.z1 < bBase + sb.z2 &&
        aBase + sa.z2 > bBase + sb.z1
    )
  );
}
