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

/** Виды кирпичей, которые автоподрез под плиту может резать целиком. */
const PLATE_CUTTABLE_KINDS = new Set<BrickFootprint["kind"]>(["standard", "cut", "firebrick"]);

function intersectBox(a: BrickBox, b: BrickBox): BrickBox | null {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);
  return x2 - x1 > EPS && y2 - y1 > EPS ? { x1, y1, x2, y2 } : null;
}

/**
 * Автоподрез кирпича под садящийся элемент (flush-плита, колосник): верх
 * кирпича в зоне следа срезается на толщину элемента — остаётся полка, на
 * которую элемент ложится заподлицо с верхом ряда. Целый кирпич превращается
 * в «резаный» (kind custom с вырезом); уже подрезанный ПЕРЕ-РЕЗАЕТСЯ под
 * посадку: вырез расширяется до зоны следа, глубина полки выравнивается на
 * толщину элемента (и мелкая, и слишком глубокая) — иначе элемент либо
 * упирался в тело кирпича, либо проваливался ниже ряда.
 * Возвращает кирпич без изменений, когда резать нечего, и null, когда подрез
 * невозможен (элемент не режется — останется честный конфликт).
 */
export function cutBrickForPlate(
  brick: PlacedBrick,
  plate: BrickFootprint,
  plateThicknessMm: number,
  label = "Подрез под плиту"
): PlacedBrick | null {
  const bounds = brickBounds(brick);
  const inter = intersectBox(bounds, brickBounds(plate));
  if (!inter) return brick;

  // локальный вырез, заякоренный в грань/угол (контракт brickBoxes):
  // «плавающую» сторону дотягиваем до ближайшей грани — рез с небольшим запасом
  const w = bounds.x2 - bounds.x1;
  const h = bounds.y2 - bounds.y1;
  let nx1 = inter.x1 - bounds.x1;
  let nx2 = inter.x2 - bounds.x1;
  let ny1 = inter.y1 - bounds.y1;
  let ny2 = inter.y2 - bounds.y1;
  if (nx1 > EPS && nx2 < w - EPS) { if (nx1 <= w - nx2) nx1 = 0; else nx2 = w; }
  if (ny1 > EPS && ny2 < h - EPS) { if (ny1 <= h - ny2) ny1 = 0; else ny2 = h; }

  if (PLATE_CUTTABLE_KINDS.has(brick.kind)) {
    return {
      ...brick,
      kind: "custom",
      orientation: "h", // форма описана прямо в координатах следа
      notchCorner: undefined,
      custom: {
        name: label,
        w,
        h,
        notch: { x1: nx1, y1: ny1, x2: nx2, y2: ny2 },
        ledge: true,
        notchDepthMm: plateThicknessMm,
        // шамот остаётся шамотом в смете и цвете
        cutFrom: brick.kind as "standard" | "cut" | "firebrick"
      }
    };
  }

  // Уже подрезанный кирпич (четверть/резак с полкой). Сквозной вырез
  // (ledge: false) не пере-резаем: полку из дыры не вернуть — честный конфликт,
  // если элемент заходит на тело.
  const notch = notchBox(brick);
  if ((brick.kind === "rebate" || brick.kind === "custom") && notch && brick.custom?.ledge !== false) {
    const depth = brick.custom?.notchDepthMm ?? BRICK_MM / 2;
    const covers =
      notch.x1 <= inter.x1 + EPS &&
      notch.y1 <= inter.y1 + EPS &&
      notch.x2 >= inter.x2 - EPS &&
      notch.y2 >= inter.y2 - EPS;
    if (covers && Math.abs(depth - plateThicknessMm) < EPS) return brick;
    if (covers) {
      // вырез уже накрывает след — только выравниваем глубину полки под толщину
      return {
        ...brick,
        custom: { ...(brick.custom ?? { name: "", w, h, notch: null }), notchDepthMm: plateThicknessMm }
      };
    }
    // вырез не накрывает след — расширяем: bbox-объединение старого выреза с
    // зоной следа (обе части заякорены в грани, объединение тоже — контракт
    // brickBoxes сохраняется; возможный лишний запас между ними уходит в рез)
    return {
      ...brick,
      kind: "custom",
      orientation: "h",
      notchCorner: undefined,
      custom: {
        name: label,
        w,
        h,
        notch: {
          x1: Math.min(nx1, notch.x1 - bounds.x1),
          y1: Math.min(ny1, notch.y1 - bounds.y1),
          x2: Math.max(nx2, notch.x2 - bounds.x1),
          y2: Math.max(ny2, notch.y2 - bounds.y1)
        },
        ledge: true,
        notchDepthMm: plateThicknessMm,
        cutFrom: brick.custom?.cutFrom
      }
    };
  }

  return null;
}

/**
 * Посадка садящегося элемента (flush-плита, колосник): высота низа от низа
 * ряда, мм. Есть ОПОРА под следом (кирпич телом или полкой — пере-рез при
 * установке выравнивает полку на толщину элемента) — верх элемента ложится
 * заподлицо с верхом ряда (65 − t). Опоры нет — элемент НЕ висит в воздухе,
 * а ложится на низ своего ряда (на кладку ряда ниже). Сквозной вырез
 * (ledge: false) опорой не считается — там дыра; накладные (плита поверх,
 * задвижка) и другой колосник тоже не опора.
 */
export function plateSeatZ(rowBricks: BrickFootprint[], plate: BrickFootprint): number {
  const t = plate.custom?.thicknessMm ?? (plate.kind === "grate" ? GRATE_THICKNESS_MM : PLATE_THICKNESS_MM);
  const bounds = brickBounds(plate);
  const supported = rowBricks.some((brick) => {
    if (isOverlayKind(brick.kind) || brick.kind === "grate") return false;
    if (brick.custom?.ledge === false) return brickBoxes(brick).some((box) => boxesIntersect(box, bounds));
    return boxesIntersect(brickBounds(brick), bounds);
  });
  return supported ? BRICK_MM - t : 0;
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

export type PlacementPlan = {
  /** Новый rows или null, если размещение отклонено. */
  rows: Record<number, PlacedBrick[]> | null;
  /** Кто помешал (для подсветки отказа); пуст при выходе за сетку. */
  conflicts: PlacedBrick[];
};

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
 * Возвращает и результат, и виновников отказа — UI подсвечивает их печнику.
 */
export function planPlacement(
  rows: Record<number, PlacedBrick[]>,
  row: number,
  rawDrafts: PlacedBrick[],
  grid: GridSpec
): PlacementPlan {
  if (!rawDrafts.length) return { rows: null, conflicts: [] };
  if (rawDrafts.some((draft) => !isInsideGrid(draft, grid))) return { rows: null, conflicts: [] };

  // «Садящиеся» элементы (flush-плита, колосник) при одиночной установке САМИ
  // подрезают кирпичи своего ряда под след: полновысотные получают полку
  // глубиной в толщину элемента, уже вырезанные пере-резаются под посадку
  // (вырез расширяется до следа, глубина выравнивается) — элемент всегда
  // ложится заподлицо с верхом ряда. Нережимое (дверца, обвязка…) остаётся
  // честным конфликтом.
  const isSeated = (b: PlacedBrick) => b.kind === "grate" || (b.kind === "plate" && b.custom?.flush === true);
  const seatedThickness = (b: PlacedBrick) =>
    b.custom?.thicknessMm ?? (b.kind === "grate" ? GRATE_THICKNESS_MM : PLATE_THICKNESS_MM);
  const singleSeated = rawDrafts.length === 1 && isSeated(rawDrafts[0]) ? rawDrafts[0] : null;
  let baseRow = rows[row] ?? [];
  if (singleSeated) {
    const t = seatedThickness(singleSeated);
    const cutLabel = singleSeated.kind === "grate" ? "Подрез под колосник" : "Подрез под плиту";
    baseRow = baseRow.map((brick) => {
      if (isOverlayKind(brick.kind) || brick.kind === "grate") return brick;
      return cutBrickForPlate(brick, singleSeated, t, cutLabel) ?? brick;
    });
  }
  const workRows = singleSeated ? { ...rows, [row]: baseRow } : rows;

  // Авто-обвязка колосника: вокруг следа само выкладывается посадочное кольцо
  // из резаных кирпичей с пазами в его толщину — колосник «обставляется»
  // кирпичами и ложится заподлицо даже на пустом месте. Куски, которым мешает
  // существующая кладка (под следом она уже пере-резана), элемент другого ряда
  // (дверца) или край сетки, просто не ставятся. Заменяемый колосник помехой
  // не считается — его сейчас снимут.
  let ring: PlacedBrick[] = [];
  if (singleSeated && singleSeated.kind === "grate" && singleSeated.custom) {
    const replacedIds = new Set(
      baseRow.filter((b) => b.kind === "grate" && overlaps(b, singleSeated)).map((b) => b.id)
    );
    const obstacles = Object.values(workRows).flat().filter((b) => !replacedIds.has(b.id));
    ring = grateRingBricks(singleSeated, seatedThickness(singleSeated), row, singleSeated.id).filter(
      (piece) => isInsideGrid(piece, grid) && !obstacles.some((b) => overlaps3D(piece, b))
    );
  }

  // Садящийся элемент получает посадку НА УСТАНОВКЕ: заподлицо при опоре
  // (plateSeatZ, уже с учётом автоподреза и кольца обвязки), на низ ряда без.
  // Считаем до коллизий — занятые объёмы зависят от неё.
  // (элемент без custom-спеки — легаси из старых проектов: посадку не штампуем,
  // solids/рендер используют дефолт «верх заподлицо»)
  const drafts = rawDrafts.map((draft) =>
    isSeated(draft) && draft.custom
      ? {
          ...draft,
          custom: {
            ...draft.custom,
            seatZMm: plateSeatZ([...baseRow, ...ring, ...rawDrafts.filter((d) => d !== draft)], draft)
          }
        }
      : draft
  );

  const conflicts = Object.values(workRows)
    .flat()
    .filter((brick) => drafts.some((draft) => overlaps3D(draft, brick)));

  // Повторный клик плитой по плите СВОЕГО ряда — замена: так печник меняет
  // размер/посадку уже стоящей плиты, не стирая её ластиком. Сравниваем в
  // плане (не 3D): плиты «поверх» и «заподлицо» живут на разных высотах,
  // но занимают одно место на ряду.
  if (drafts.length === 1 && (drafts[0].kind === "plate" || drafts[0].kind === "grate")) {
    const target = drafts[0];
    const replacedSame = baseRow.filter((brick) => brick.kind === target.kind && overlaps(brick, target));
    if (replacedSame.length) {
      const replaced = new Set(replacedSame.map((brick) => brick.id));
      const remaining = conflicts.filter((brick) => !replaced.has(brick.id));
      if (remaining.length) return { rows: null, conflicts: remaining };
      return {
        rows: { ...workRows, [row]: [...baseRow.filter((brick) => !replaced.has(brick.id)), ...drafts, ...ring] },
        conflicts: []
      };
    }
  }

  // плита, колосник и задвижка никого не заменяют: занято — отказ
  if (drafts.some((draft) => draft.kind === "plate" || draft.kind === "damper" || draft.kind === "grate")) {
    if (conflicts.length) return { rows: null, conflicts };
    return { rows: { ...workRows, [row]: [...baseRow, ...drafts, ...ring] }, conflicts: [] };
  }

  if (drafts.length === 1) {
    // «тап — заменил» действует только в своём ряду; плиту/задвижку тапом не
    // стираем — их снимают ластиком осознанно
    const blocking = conflicts.filter((brick) => brick.row !== row || brick.kind === "plate" || brick.kind === "damper");
    if (blocking.length) return { rows: null, conflicts: blocking };
    const replaced = new Set(conflicts.map((brick) => brick.id));
    return {
      rows: { ...rows, [row]: [...(rows[row] ?? []).filter((brick) => !replaced.has(brick.id)), ...drafts] },
      conflicts: []
    };
  }

  if (conflicts.length) return { rows: null, conflicts };
  return { rows: { ...rows, [row]: [...(rows[row] ?? []), ...drafts] }, conflicts: [] };
}

export function placeBricksInRows(
  rows: Record<number, PlacedBrick[]>,
  row: number,
  drafts: PlacedBrick[],
  grid: GridSpec
): Record<number, PlacedBrick[]> | null {
  return planPlacement(rows, row, drafts, grid).rows;
}

/**
 * Кирпичи, физически перекрывающие канал под задвижкой: сплошная кладка её
 * ряда в плане под рамкой. Вентканалы (размеченные пустоты) и накладные
 * элементы каналом не считаются помехой. Мягкое правило — только предупреждение
 * в UI, размещение не блокирует.
 */
export function damperBlockers(rowBricks: PlacedBrick[], damper: BrickFootprint): PlacedBrick[] {
  return rowBricks.filter(
    (brick) => brick.kind !== "vent" && !isOverlayKind(brick.kind) && overlaps(brick, damper)
  );
}

// Бывшая «сборка колосника» (grate + 4 подрезки-trim) удалена: колосник, как и
// плита, получает опору автоподрезом кирпичей при установке. Kind "trim"
// сохранён для старых проектов.

/** Минимальная длина куска обвязки — 50 мм: слипы тоньше не кладём. */
const RING_MIN_LEN = 0.4;

/**
 * Обвязка колосника: посадочное кольцо из резаных кирпичей вокруг следа.
 * Каждый кусок — ячейка в ширину, на полячейки заходит ПОД решётку; по
 * внутренней кромке — паз глубиной в толщину решётки, на его полку она и
 * ложится. Северная/южная ленты накрывают углы (у угловых кусков полка
 * Г-образно короче — заякорена в грань, контракт brickBoxes соблюдён),
 * западная/восточная — между ними. Куски длиннее кирпича (2 ячеек) режутся
 * поровну. Узкий колосник (шириной в ячейку) опирается только на две ленты.
 */
export function grateRingBricks(grate: BrickFootprint, thicknessMm: number, row: number, idPrefix: string): PlacedBrick[] {
  const b = brickBounds(grate);
  const pieces: PlacedBrick[] = [];
  let n = 0;
  const push = (x: number, y: number, w: number, h: number, notch: BrickBox) => {
    pieces.push({
      id: `${idPrefix}-ring-${n++}`,
      row,
      x,
      y,
      kind: "custom",
      orientation: "h",
      custom: { name: "Обвязка колосника", w, h, notch, ledge: true, notchDepthMm: thicknessMm }
    });
  };
  const split = (len: number): number[] => {
    const count = Math.max(1, Math.ceil(len / 2 - EPS));
    return Array.from({ length: count }, () => len / count);
  };

  for (const side of ["n", "s"] as const) {
    const py = side === "n" ? b.y1 - 0.5 : b.y2 - 0.5;
    let px = b.x1 - 0.5;
    for (const len of split(b.x2 - b.x1 + 1)) {
      // полка только под следом решётки — угловые куски получают срез короче тела
      const nx1 = Math.max(px, b.x1) - px;
      const nx2 = Math.min(px + len, b.x2) - px;
      push(px, py, len, 1, { x1: nx1, y1: side === "n" ? 0.5 : 0, x2: nx2, y2: side === "n" ? 1 : 0.5 });
      px += len;
    }
  }

  const sideLen = b.y2 - b.y1 - 1;
  if (sideLen >= RING_MIN_LEN) {
    for (const side of ["w", "e"] as const) {
      const px = side === "w" ? b.x1 - 0.5 : b.x2 - 0.5;
      let py = b.y1 + 0.5;
      for (const len of split(sideLen)) {
        push(px, py, 1, len, side === "w" ? { x1: 0.5, y1: 0, x2: 1, y2: len } : { x1: 0, y1: 0, x2: 0.5, y2: len });
        py += len;
      }
    }
  }
  return pieces;
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
  // Исключение — полностью срезанный кирпич (автоподрез под плиту): тела нет,
  // иначе его было бы не стереть; попадание считаем по габариту.
  const covers = (brick: PlacedBrick) => {
    const boxes = brickBoxes(brick);
    if (!boxes.length) {
      const b = brickBounds(brick);
      return x >= b.x1 && x < b.x2 && y >= b.y1 && y < b.y2;
    }
    return boxes.some((b) => x >= b.x1 && x < b.x2 && y >= b.y1 && y < b.y2);
  };
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
