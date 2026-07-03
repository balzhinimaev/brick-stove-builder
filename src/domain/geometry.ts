import { BRICK_GAP, BRICK_LAYER_HEIGHT, CELL_CM, MIN_GRID_COLS, MIN_GRID_ROWS } from "./constants";
import type { BrickFootprint, GridSpec, NotchCorner, Orientation, Parameters, PlacedBrick } from "./types";

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
export function brickBoxes(brick: BrickFootprint): BrickBox[] {
  const b = brickBounds(brick);
  const notch = notchBox(brick);
  if (!notch) return [b];

  const west = notch.x1 <= b.x1 + EPS;
  const north = notch.y1 <= b.y1 + EPS;
  const fullX = west && notch.x2 >= b.x2 - EPS;
  const fullY = north && notch.y2 >= b.y2 - EPS;

  // паз во всю грань — остаётся один бокс
  if (fullY) return [west ? { x1: notch.x2, y1: b.y1, x2: b.x2, y2: b.y2 } : { x1: b.x1, y1: b.y1, x2: notch.x1, y2: b.y2 }];
  if (fullX) return [north ? { x1: b.x1, y1: notch.y2, x2: b.x2, y2: b.y2 } : { x1: b.x1, y1: b.y1, x2: b.x2, y2: notch.y1 }];

  // угловой вырез — Г из двух боксов
  return [
    west ? { x1: notch.x2, y1: b.y1, x2: b.x2, y2: b.y2 } : { x1: b.x1, y1: b.y1, x2: notch.x1, y2: b.y2 },
    {
      x1: west ? b.x1 : notch.x1,
      x2: west ? notch.x2 : b.x2,
      y1: north ? notch.y2 : b.y1,
      y2: north ? b.y2 : notch.y1
    }
  ];
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

/** Плита — накладной элемент: лежит ПОВЕРХ ряда и с кирпичами не конфликтует. */
export function isOverlayKind(kind: BrickFootprint["kind"]): boolean {
  return kind === "plate";
}

/**
 * Накладная ли КОНКРЕТНАЯ плита: в режиме «заподлицо» (flush) плита утоплена
 * в ряд, участвует в честных 3D-коллизиях и ложится в вырезы кирпичей.
 */
export function isOverlayBrick(brick: BrickFootprint): boolean {
  return brick.kind === "plate" && brick.custom?.flush !== true;
}

/** Ряд кладки: кирпич на плашку 65 мм + шов ≈ 70 мм. */
export const COURSE_MM = 70;
export const BRICK_MM = 65;
/** Толщина колосниковой решётки; лежит заподлицо с верхом ряда. */
const GRATE_THICKNESS_MM = 22;
/** Толщина варочной плиты по умолчанию. */
const PLATE_THICKNESS_MM = 14;
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
    // заподлицо: верх плиты = верх ряда, опирается на полки вырезов;
    // поверх: лежит на ряду
    return brick.custom?.flush === true
      ? [{ box: bounds, z1: BRICK_MM - t, z2: BRICK_MM }]
      : [{ box: bounds, z1: BRICK_MM, z2: BRICK_MM + t }];
  }
  if (brick.kind === "grate") return [{ box: bounds, z1: BRICK_MM - GRATE_THICKNESS_MM, z2: BRICK_MM }];
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

/**
 * Честное 3D-пересечение: план И высота, с учётом рядов (дверца из ряда N
 * занимает объём над рядами N+1, N+2…). Плита — накладная: с кладкой не
 * конфликтует, только плита с плитой.
 */
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

/** Совместимая обёртка для сценариев в пределах одного ряда (тесты, утилиты). */
export function placeBrickInRow(rowBricks: PlacedBrick[], draft: PlacedBrick, grid: GridSpec): PlacedBrick[] {
  return placeBricksInRow(rowBricks, [draft], grid);
}

export function placeBricksInRow(rowBricks: PlacedBrick[], drafts: PlacedBrick[], grid: GridSpec): PlacedBrick[] {
  const row = drafts[0]?.row ?? 1;
  const result = placeBricksInRows({ [row]: rowBricks }, row, drafts, grid);
  return result ? result[row] : rowBricks;
}

/**
 * Правила размещения (честные, 3D, между рядами):
 * - конфликт = пересечение и в плане, и по ВЫСОТЕ (overlaps3D): дверца из
 *   нижнего ряда блокирует объём над собой, полка выреза пускает только то,
 *   что помещается над ней, колосник — только верхние 22 мм ряда;
 * - плита накладная: с кладкой не конфликтует, две плиты внахлёст — отказ;
 * - ОДИНОЧНЫЙ кирпич перекладывает конфликтующих В СВОЁМ ряду («тап —
 *   заменил»); конфликт с элементом ДРУГОГО ряда — отказ, чужие ряды молча
 *   не трогаем;
 * - сборка из нескольких частей на занятое место — отказ без изменений.
 * Возвращает новый rows или null, если размещение отклонено.
 */
export function placeBricksInRows(
  rows: Record<number, PlacedBrick[]>,
  row: number,
  drafts: PlacedBrick[],
  grid: GridSpec
): Record<number, PlacedBrick[]> | null {
  if (!drafts.length) return null;
  if (drafts.some((draft) => !isInsideGrid(draft, grid))) return null;

  const conflicts = Object.values(rows)
    .flat()
    .filter((brick) => drafts.some((draft) => overlaps3D(draft, brick)));

  // плита (и накладная, и заподлицо) никого не заменяет: занято — отказ
  if (drafts.some((draft) => draft.kind === "plate")) {
    if (conflicts.length) return null;
    return { ...rows, [row]: [...(rows[row] ?? []), ...drafts] };
  }

  if (drafts.length === 1) {
    if (conflicts.some((brick) => brick.row !== row)) return null;
    const replaced = new Set(conflicts.map((brick) => brick.id));
    return { ...rows, [row]: [...(rows[row] ?? []).filter((brick) => !replaced.has(brick.id)), ...drafts] };
  }

  if (conflicts.length) return null;
  return { ...rows, [row]: [...(rows[row] ?? []), ...drafts] };
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
  // существующие проверяем честно по высоте (полки/колосники/дверцы),
  // свои черновики — в плане (все полной высоты)
  const collides = (candidate: PlacedBrick) =>
    existing.some((brick) => overlaps3D(candidate, brick)) || drafts.some((brick) => overlaps(brick, candidate));

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
  const covers = (brick: PlacedBrick) =>
    brickBoxes(brick).some((b) => x >= b.x1 && x < b.x2 && y >= b.y1 && y < b.y2);
  // Плита лежит поверх кладки: сначала снимаем её, кирпичи под ней не трогаем.
  const overlayHit = rowBricks.some((brick) => isOverlayKind(brick.kind) && covers(brick));
  if (overlayHit) return rowBricks.filter((brick) => !(isOverlayKind(brick.kind) && covers(brick)));
  return rowBricks.filter((brick) => !covers(brick));
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

export function brickWorldGeometry(brick: Pick<PlacedBrick, "x" | "y" | "row" | "kind" | "orientation" | "custom">, grid: GridSpec): BrickWorldGeometry {
  const size = footprintSizeOf(brick);
  const center = cellToWorld(brick.x + size.w / 2, brick.y + size.h / 2, grid);
  const y = (brick.row - 0.5) * BRICK_LAYER_HEIGHT;
  return {
    position: [center.x, y, center.z],
    scale: [Math.max(0.1, size.w - BRICK_GAP), BRICK_LAYER_HEIGHT * 0.92, Math.max(0.1, size.h - BRICK_GAP)]
  };
}
