import { BRICK_GAP, BRICK_LAYER_HEIGHT, CELL_CM, MIN_GRID_COLS, MIN_GRID_ROWS } from "./constants";
import type { BrickFootprint, GridSpec, NotchCorner, Orientation, Parameters, PlacedBrick } from "./types";

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
  return { cols, rows, widthCm: parameters.foundationWidth, lengthCm: parameters.foundationLength };
}

export type BrickSize = { w: number; h: number };

export function brickSizeFor(kind: BrickFootprint["kind"], orientation: Orientation): BrickSize {
  if (kind === "grate") return orientation === "h" ? { w: 3, h: 2 } : { w: 2, h: 3 };
  // Варочная плита: 5×3 ячейки = 625×375 мм (близко к двухконфорочной чугунной).
  if (kind === "plate") return orientation === "h" ? { w: 5, h: 3 } : { w: 3, h: 5 };
  if (kind === "trim") return orientation === "h" ? { w: 0.5, h: 1 } : { w: 1, h: 0.5 };
  const isCutLike = kind === "cut" || kind === "cleanout";
  if (orientation === "h") return { w: isCutLike ? 1 : 2, h: 1 };
  return { w: 1, h: isCutLike ? 1 : 2 };
}

const DEFAULT_NOTCH: NotchCorner = "ne";

export type BrickBox = { x1: number; y1: number; x2: number; y2: number };

export function brickBounds(brick: BrickFootprint): BrickBox {
  const size = brickSizeFor(brick.kind, brick.orientation);
  return { x1: brick.x, y1: brick.y, x2: brick.x + size.w, y2: brick.y + size.h };
}

export function isInsideGrid(brick: BrickFootprint, grid: GridSpec): boolean {
  const b = brickBounds(brick);
  return b.x1 >= 0 && b.y1 >= 0 && b.x2 <= grid.cols && b.y2 <= grid.rows;
}

/**
 * Кирпич с четвертью («rebate») — не прямоугольник: из его габарита в углу
 * `notchCorner` вырезана четверть (половина длины × половина ширины — то самое
 * «режут до середины»). Вырез — СВОБОДНОЕ место: коллизии считаются только по
 * Г-образной занятой части, поэтому в четверть можно посадить колосник, плиту
 * или обычный кирпич. Любой кирпич здесь — набор занятых боксов.
 */
/** Глубина паза вдоль грани — полячейки (≈6 см), как под опору колосника. */
const EDGE_NOTCH_DEPTH = 0.5;

const EDGE_NOTCHES = new Set<NotchCorner>(["n", "e", "s", "w"]);

export function brickBoxes(brick: BrickFootprint): BrickBox[] {
  const b = brickBounds(brick);
  if (brick.kind !== "rebate") return [b];
  const corner = brick.notchCorner ?? DEFAULT_NOTCH;

  if (EDGE_NOTCHES.has(corner)) {
    // паз вдоль всей грани: остаётся один бокс
    const d = EDGE_NOTCH_DEPTH;
    if (corner === "e") return [{ x1: b.x1, y1: b.y1, x2: b.x2 - d, y2: b.y2 }];
    if (corner === "w") return [{ x1: b.x1 + d, y1: b.y1, x2: b.x2, y2: b.y2 }];
    if (corner === "n") return [{ x1: b.x1, y1: b.y1 + d, x2: b.x2, y2: b.y2 }];
    return [{ x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2 - d }];
  }

  const midX = (b.x1 + b.x2) / 2;
  const midY = (b.y1 + b.y2) / 2;
  const west = corner === "nw" || corner === "sw";
  const north = corner === "nw" || corner === "ne";
  return [
    // половина по длине без выреза — занята целиком
    west ? { x1: midX, y1: b.y1, x2: b.x2, y2: b.y2 } : { x1: b.x1, y1: b.y1, x2: midX, y2: b.y2 },
    // полоса рядом с вырезом
    west
      ? { x1: b.x1, x2: midX, y1: north ? midY : b.y1, y2: north ? b.y2 : midY }
      : { x1: midX, x2: b.x2, y1: north ? midY : b.y1, y2: north ? b.y2 : midY }
  ];
}

/** Сам вырез (посадочная четверть/паз) — для отрисовки полки в 3D/2D. */
export function notchBox(brick: BrickFootprint): BrickBox | null {
  if (brick.kind !== "rebate") return null;
  const b = brickBounds(brick);
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

export function placeBrickInRow(rowBricks: PlacedBrick[], draft: PlacedBrick, grid: GridSpec): PlacedBrick[] {
  if (!isInsideGrid(draft, grid)) return rowBricks;
  return [...rowBricks.filter((brick) => !overlaps(brick, draft)), draft];
}

export function placeBricksInRow(rowBricks: PlacedBrick[], drafts: PlacedBrick[], grid: GridSpec): PlacedBrick[] {
  if (!drafts.length) return rowBricks;
  if (drafts.some((draft) => !isInsideGrid(draft, grid))) return rowBricks;
  return [...rowBricks.filter((brick) => !drafts.some((draft) => overlaps(brick, draft))), ...drafts];
}

export function grateAssemblyBricks(row: number, x: number, y: number, orientation: Orientation, nextId: () => number): PlacedBrick[] {
  const grate: PlacedBrick = { id: `r${row}-${nextId()}-${x}-${y}`, row, x, y, kind: "grate", orientation };
  if (orientation === "h") {
    return [
      grate,
      { id: `r${row}-${nextId()}-${x - 0.5}-${y}`, row, x: x - 0.5, y, kind: "trim", orientation: "h" },
      { id: `r${row}-${nextId()}-${x - 0.5}-${y + 1}`, row, x: x - 0.5, y: y + 1, kind: "trim", orientation: "h" },
      { id: `r${row}-${nextId()}-${x + 3}-${y}`, row, x: x + 3, y, kind: "trim", orientation: "h" },
      { id: `r${row}-${nextId()}-${x + 3}-${y + 1}`, row, x: x + 3, y: y + 1, kind: "trim", orientation: "h" }
    ];
  }
  return [
    grate,
    { id: `r${row}-${nextId()}-${x}-${y - 0.5}`, row, x, y: y - 0.5, kind: "trim", orientation: "v" },
    { id: `r${row}-${nextId()}-${x + 1}-${y - 0.5}`, row, x: x + 1, y: y - 0.5, kind: "trim", orientation: "v" },
    { id: `r${row}-${nextId()}-${x}-${y + 3}`, row, x, y: y + 3, kind: "trim", orientation: "v" },
    { id: `r${row}-${nextId()}-${x + 1}-${y + 3}`, row, x: x + 1, y: y + 3, kind: "trim", orientation: "v" }
  ];
}

/**
 * Greedy row auto-fill: walks the grid and lays full bricks in the given
 * orientation wherever they fit, then plugs remaining single cells with `cut`
 * halves. Existing bricks are kept untouched; returned drafts never overlap
 * them or each other.
 */
export function fillRowBricks(
  existing: PlacedBrick[],
  grid: GridSpec,
  row: number,
  orientation: Orientation,
  nextId: () => number
): PlacedBrick[] {
  const drafts: PlacedBrick[] = [];
  const collides = (candidate: BrickFootprint) =>
    existing.some((brick) => overlaps(brick, candidate)) || drafts.some((brick) => overlaps(brick, candidate));

  const tryPlace = (x: number, y: number, kind: "standard" | "cut") => {
    const candidate: PlacedBrick = { id: `r${row}-fill-${nextId()}-${x}-${y}`, row, x, y, kind, orientation };
    if (!isInsideGrid(candidate, grid) || collides(candidate)) return false;
    drafts.push(candidate);
    return true;
  };

  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      tryPlace(x, y, "standard") || tryPlace(x, y, "cut");
    }
  }
  return drafts;
}

export function pruneRowsToGrid(rows: Record<number, PlacedBrick[]>, grid: GridSpec): Record<number, PlacedBrick[]> {
  return Object.fromEntries(
    Object.entries(rows).map(([row, bricks]) => [row, bricks.filter((brick) => isInsideGrid(brick, grid))])
  ) as Record<number, PlacedBrick[]>;
}

export function removeBrickAt(rowBricks: PlacedBrick[], x: number, y: number): PlacedBrick[] {
  // Клик в вырез четверти кирпич не задевает — там «живёт» другой элемент.
  return rowBricks.filter(
    (brick) => !brickBoxes(brick).some((b) => x >= b.x1 && x < b.x2 && y >= b.y1 && y < b.y2)
  );
}

export function cloneRows(rows: Record<number, PlacedBrick[]>): Record<number, PlacedBrick[]> {
  return Object.fromEntries(
    Object.entries(rows).map(([row, bricks]) => [row, bricks.map((brick) => ({ ...brick }))])
  ) as Record<number, PlacedBrick[]>;
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

export function brickWorldGeometry(brick: Pick<PlacedBrick, "x" | "y" | "row" | "kind" | "orientation">, grid: GridSpec): BrickWorldGeometry {
  const size = brickSizeFor(brick.kind, brick.orientation);
  const center = cellToWorld(brick.x + size.w / 2, brick.y + size.h / 2, grid);
  const y = (brick.row - 0.5) * BRICK_LAYER_HEIGHT;
  return {
    position: [center.x, y, center.z],
    scale: [Math.max(0.1, size.w - BRICK_GAP), BRICK_LAYER_HEIGHT * 0.92, Math.max(0.1, size.h - BRICK_GAP)]
  };
}
