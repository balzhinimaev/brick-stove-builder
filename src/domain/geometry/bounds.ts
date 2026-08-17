import { BRICK_GAP, BRICK_LAYER_HEIGHT, CELL_CM, MIN_GRID_COLS, MIN_GRID_ROWS } from "../constants";
import type { BrickFootprint, GridSpec, NotchCorner, Orientation, Parameters, PlacedBrick } from "../types";

const EPS = 1e-6;

/**
 * Привязка координаты клика к шагу сетки: пол в ближайший узел шага,
 * с зажимом внутрь сетки (чтобы наведённая ячейка не выпадала за край).
 */
export function snapToStep(value: number, step: number, max: number): number {
  const snapped = Math.floor(value / step) * step;
  return Math.min(Math.max(0, snapped), Math.max(0, max - step));
}

export function gridFromParameters(parameters: Parameters): GridSpec {
  const cols = Math.max(MIN_GRID_COLS, Math.round(parameters.foundationWidth / CELL_CM));
  const rows = Math.max(MIN_GRID_ROWS, Math.round(parameters.foundationLength / CELL_CM));
  // Габариты — от фактической сетки, а не от введённого параметра: вся
  // кирпичная математика считает ячейку 12.5 см, и подписи осей обязаны
  // совпадать с ней (120 см округляется до 10 ячеек = 125 см).
  return { cols, rows, widthCm: cols * CELL_CM, lengthCm: rows * CELL_CM };
}

export type BrickSize = { w: number; h: number };

export function brickSizeFor(kind: BrickFootprint["kind"], orientation: Orientation): BrickSize {
  if (kind === "grate") return orientation === "h" ? { w: 3, h: 2 } : { w: 2, h: 3 };
  // Варочная плита: 5×3 ячейки = 625×375 мм (близко к двухконфорочной чугунной).
  if (kind === "plate") return orientation === "h" ? { w: 5, h: 3 } : { w: 3, h: 5 };
  // Задвижка дымохода: проём 250×130 мм = 2×1 ячейки (ходовой типоразмер).
  if (kind === "damper") return orientation === "h" ? { w: 2, h: 1 } : { w: 1, h: 2 };
  if (kind === "trim") return orientation === "h" ? { w: 0.5, h: 1 } : { w: 1, h: 0.5 };
  const isCutLike = kind === "cut" || kind === "cleanout";
  if (orientation === "h") return { w: isCutLike ? 1 : 2, h: 1 };
  return { w: 1, h: isCutLike ? 1 : 2 };
}

const DEFAULT_NOTCH: NotchCorner = "ne";

/**
 * Размер следа с учётом кастомной формы: у «резаных» кирпичей — форма из
 * резака, у плиты — выбранный размер в мм. Элемент без custom берёт типовой
 * габарит своего вида.
 */
export function footprintSizeOf(brick: BrickFootprint): BrickSize {
  if (brick.custom) {
    return brick.orientation === "h"
      ? { w: brick.custom.w, h: brick.custom.h }
      : { w: brick.custom.h, h: brick.custom.w };
  }
  return brickSizeFor(brick.kind, brick.orientation);
}

export type BrickBox = { x1: number; y1: number; x2: number; y2: number };

export function brickBounds(brick: BrickFootprint): BrickBox {
  const size = footprintSizeOf(brick);
  return { x1: brick.x, y1: brick.y, x2: brick.x + size.w, y2: brick.y + size.h };
}

export function isInsideGrid(brick: BrickFootprint, grid: GridSpec): boolean {
  const b = brickBounds(brick);
  return b.x1 >= 0 && b.y1 >= 0 && b.x2 <= grid.cols && b.y2 <= grid.rows;
}

/** Глубина паза вдоль грани — полячейки (≈6 см), как под опору колосника. */
const EDGE_NOTCH_DEPTH = 0.5;

const EDGE_NOTCHES = new Set<NotchCorner>(["n", "e", "s", "w"]);

/**
 * Сам вырез (посадочная четверть/паз) в абсолютных координатах сетки — для
 * коллизий и отрисовки полки. Для «четверти» вычисляется из notchCorner, для
 * кастомного кирпича берётся из спецификации резака (с поворотом при
 * вертикальной ориентации).
 */
export function notchBox(brick: BrickFootprint): BrickBox | null {
  const b = brickBounds(brick);

  if (brick.kind === "custom") {
    const notch = brick.custom?.notch;
    if (!notch) return null;
    if (brick.orientation === "h") {
      return { x1: b.x1 + notch.x1, y1: b.y1 + notch.y1, x2: b.x1 + notch.x2, y2: b.y1 + notch.y2 };
    }
    // поворот заготовки на 90° по часовой: (x, y) → (h − y, x)
    const h = brick.custom?.h ?? 0;
    return { x1: b.x1 + h - notch.y2, y1: b.y1 + notch.x1, x2: b.x1 + h - notch.y1, y2: b.y1 + notch.x2 };
  }

  if (brick.kind !== "rebate") return null;
  const corner = brick.notchCorner ?? DEFAULT_NOTCH;

  if (EDGE_NOTCHES.has(corner)) {
    const d = EDGE_NOTCH_DEPTH;
    if (corner === "e") return { x1: b.x2 - d, y1: b.y1, x2: b.x2, y2: b.y2 };
    if (corner === "w") return { x1: b.x1, y1: b.y1, x2: b.x1 + d, y2: b.y2 };
    if (corner === "n") return { x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y1 + d };
    return { x1: b.x1, y1: b.y2 - d, x2: b.x2, y2: b.y2 };
  }

  const midX = (b.x1 + b.x2) / 2;
  const midY = (b.y1 + b.y2) / 2;
  return {
    x1: corner === "nw" || corner === "sw" ? b.x1 : midX,
    x2: corner === "nw" || corner === "sw" ? midX : b.x2,
    y1: corner === "nw" || corner === "ne" ? b.y1 : midY,
    y2: corner === "nw" || corner === "ne" ? midY : b.y2
  };
}

/**
 * Кирпич с вырезом — не прямоугольник: вырез (четверть у угла, паз вдоль грани
 * или произвольный из резака) — СВОБОДНОЕ место, коллизии считаются только по
 * занятой части. Любой кирпич здесь — набор занятых боксов: габарит минус вырез.
 */
/** Бокс с положительной площадью: вырез «во весь габарит» оставляет тело пустым. */
const hasArea = (box: BrickBox) => box.x2 - box.x1 > EPS && box.y2 - box.y1 > EPS;

export function brickBoxes(brick: BrickFootprint): BrickBox[] {
  const b = brickBounds(brick);
  const notch = notchBox(brick);
  if (!notch) return [b];

  const west = notch.x1 <= b.x1 + EPS;
  const north = notch.y1 <= b.y1 + EPS;
  const east = notch.x2 >= b.x2 - EPS;
  const south = notch.y2 >= b.y2 - EPS;
  // Контракт резака: вырез заякорен в угол или грань. «Плавающий» вырез в
  // середине тела разложению на 2 бокса не поддаётся — считаем кирпич целым,
  // а не молча превращаем часть тела в свободную зону.
  if (!(west || east) || !(north || south)) return [b];
  const fullX = west && east;
  const fullY = north && south;

  // паз во всю грань — остаётся один бокс; вырез во весь габарит
  // (автоподрез под плиту) — тело пустое, остаётся только полка
  if (fullY) return [west ? { x1: notch.x2, y1: b.y1, x2: b.x2, y2: b.y2 } : { x1: b.x1, y1: b.y1, x2: notch.x1, y2: b.y2 }].filter(hasArea);
  if (fullX) return [north ? { x1: b.x1, y1: notch.y2, x2: b.x2, y2: b.y2 } : { x1: b.x1, y1: b.y1, x2: b.x2, y2: notch.y1 }].filter(hasArea);

  // угловой вырез — Г из двух боксов
  return [
    west ? { x1: notch.x2, y1: b.y1, x2: b.x2, y2: b.y2 } : { x1: b.x1, y1: b.y1, x2: notch.x1, y2: b.y2 },
    {
      x1: west ? b.x1 : notch.x1,
      x2: west ? notch.x2 : b.x2,
      y1: north ? notch.y2 : b.y1,
      y2: north ? b.y2 : notch.y1
    }
  ].filter(hasArea);
}

export function cellToWorld(x: number, z: number, grid: GridSpec): { x: number; z: number } {
  return { x: x - grid.cols / 2, z: z - grid.rows / 2 };
}

export type BrickWorldGeometry = {
  position: [number, number, number];
  scale: [number, number, number];
};

/** World-space box for an arbitrary occupied box of a brick (used for L-shapes). */
export function boxWorldGeometry(box: BrickBox, row: number, grid: GridSpec): BrickWorldGeometry {
  const center = cellToWorld((box.x1 + box.x2) / 2, (box.y1 + box.y2) / 2, grid);
  return {
    position: [center.x, (row - 0.5) * BRICK_LAYER_HEIGHT, center.z],
    scale: [
      Math.max(0.08, box.x2 - box.x1 - BRICK_GAP),
      BRICK_LAYER_HEIGHT * 0.92,
      Math.max(0.08, box.y2 - box.y1 - BRICK_GAP)
    ]
  };
}

export function brickWorldGeometry(brick: Pick<PlacedBrick, "x" | "y" | "row" | "kind" | "orientation" | "custom">, grid: GridSpec): BrickWorldGeometry {
  const size = footprintSizeOf(brick);
  const center = cellToWorld(brick.x + size.w / 2, brick.y + size.h / 2, grid);
  const y = (brick.row - 0.5) * BRICK_LAYER_HEIGHT;
  return {
    position: [center.x, y, center.z],
    scale: [Math.max(0.1, size.w - BRICK_GAP), BRICK_LAYER_HEIGHT * 0.92, Math.max(0.1, size.h - BRICK_GAP)]
  };
}
