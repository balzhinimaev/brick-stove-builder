import type { BrickFootprint, GridSpec, PlacedBrick } from "../types";
import { brickBounds, brickBoxes, isInsideGrid, notchBox, type BrickBox } from "./bounds";
import { BRICK_MM, isOverlayKind, overlaps, overlaps3D } from "./collisions";

const EPS = 1e-6;
const GRATE_THICKNESS_MM = 22;
const PLATE_THICKNESS_MM = 14;

function boxesIntersect(a: BrickBox, b: BrickBox): boolean {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

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

