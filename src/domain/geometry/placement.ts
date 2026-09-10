import type { BrickFootprint, GridSpec, PlacedBrick } from "../types";
import { profileXZError } from "./convex";
import { damperGeometryError } from "./hardware";
import { cloneCustomBrick } from "./rows";
import { isSteelPart } from "../materials";
import { brickBounds, footprintSizeOf, isInsideGrid, notchBox, type BrickBox } from "./bounds";
import { BRICK_MM, boxesIntersect, brickSolids, isOverlayKind, notchDepthMm, overlaps, overlaps3D } from "./collisions";

const EPS = 1e-6;
const GRATE_THICKNESS_MM = 22;
const PLATE_THICKNESS_MM = 14;

const MASONRY_KINDS = new Set<BrickFootprint["kind"]>(["standard", "cut", "firebrick", "rebate", "custom", "trim"]);
const isSeated = (b: BrickFootprint) => b.kind === "grate" || (b.kind === "plate" && b.custom?.flush === true);
const seatedThickness = (b: BrickFootprint) =>
  b.custom?.thicknessMm ?? (b.kind === "grate" ? GRATE_THICKNESS_MM : PLATE_THICKNESS_MM);

function intersectBox(a: BrickBox, b: BrickBox): BrickBox | null {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);
  return x2 - x1 > EPS && y2 - y1 > EPS ? { x1, y1, x2, y2 } : null;
}

/**
 * Cut a ledge under the element. A cut may only remove material: existing
 * deeper notches and through-cuts cannot become shallower. The single-notch
 * format can widen a cut, but cannot represent two different ledge heights.
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
  if (brick.custom?.profileXZ || isSteelPart(brick)) return null;

  // локальный вырез, заякоренный в грань/угол (контракт brickBoxes):
  // «плавающую» сторону дотягиваем до ближайшей грани — рез с небольшим запасом
  const w = bounds.x2 - bounds.x1;
  const h = bounds.y2 - bounds.y1;
  let nx1 = inter.x1 - bounds.x1;
  let nx2 = inter.x2 - bounds.x1;
  let ny1 = inter.y1 - bounds.y1;
  let ny2 = inter.y2 - bounds.y1;
  if (nx1 > EPS && nx2 < w - EPS) {
    if (nx1 <= w - nx2) nx1 = 0;
    else nx2 = w;
  }
  if (ny1 > EPS && ny2 < h - EPS) {
    if (ny1 <= h - ny2) ny1 = 0;
    else ny2 = h;
  }

  if (!MASONRY_KINDS.has(brick.kind) || brick.kind === "trim") return null;
  const notch = notchBox(brick);
  const depth = notch ? notchDepthMm(brick) : 0;
  if (notch) {
    const covers =
      notch.x1 <= inter.x1 + EPS &&
      notch.y1 <= inter.y1 + EPS &&
      notch.x2 >= inter.x2 - EPS &&
      notch.y2 >= inter.y2 - EPS;
    if (covers && depth >= plateThicknessMm - EPS) return brick;
    if (covers)
      return {
        ...brick,
        custom: {
          ...(brick.custom ?? { name: label, ...footprintSizeOf({ ...brick, orientation: "h" }), notch: null }),
          notchDepthMm: plateThicknessMm
        }
      };
    // Cutting more of a through-cut block would require a second notch depth.
    // Keep its shape and report a collision if the plate enters remaining body.
    if (depth >= BRICK_MM - EPS) return null;
    nx1 = Math.min(nx1, notch.x1 - bounds.x1);
    ny1 = Math.min(ny1, notch.y1 - bounds.y1);
    nx2 = Math.max(nx2, notch.x2 - bounds.x1);
    ny2 = Math.max(ny2, notch.y2 - bounds.y1);
  }
  return {
    ...brick,
    kind: "custom",
    orientation: "h",
    notchCorner: undefined,
    custom: {
      name: label,
      w,
      h,
      notch: { x1: nx1, y1: ny1, x2: nx2, y2: ny2 },
      ledge: true,
      notchDepthMm: Math.max(depth, plateThicknessMm),
      cutFrom:
        brick.custom?.cutFrom ??
        (brick.kind === "standard" || brick.kind === "cut" || brick.kind === "firebrick" ? brick.kind : undefined)
    }
  };
}

/** Actual highest masonry surface beneath the footprint, measured from the course base. */
export function plateSeatZ(rowBricks: BrickFootprint[], plate: BrickFootprint): number {
  const bounds = brickBounds(plate);
  let top = 0;
  for (const brick of rowBricks) {
    if (!MASONRY_KINDS.has(brick.kind) || brick.custom?.profileXZ) continue;
    for (const solid of brickSolids(brick)) {
      if (boxesIntersect(solid.box, bounds)) top = Math.max(top, solid.z2);
    }
  }
  return top;
}

function hasSeat(rowBricks: BrickFootprint[], element: BrickFootprint): boolean {
  const seat = element.custom?.seatZMm ?? BRICK_MM - seatedThickness(element);
  return seat > EPS && Math.abs(plateSeatZ(rowBricks, element) - seat) <= EPS;
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
  reason?: "unsupported";
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
  if (
    rawDrafts.some(
      (draft) =>
        profileXZError(draft.custom) ||
        damperGeometryError(draft.custom) ||
        (draft.custom?.profileXZ && draft.kind !== "custom") ||
        (draft.custom?.material && draft.kind !== "custom") ||
        (draft.custom?.damperPlane && draft.kind !== "damper")
    )
  )
    return { rows: null, conflicts: [] };
  if (rawDrafts.some((draft) => !isInsideGrid(draft, grid))) return { rows: null, conflicts: [] };

  if (rawDrafts.some((draft) => draft.row !== row)) return { rows: null, conflicts: [] };
  if (
    rawDrafts.some(
      (draft) =>
        isSeated(draft) &&
        (!Number.isFinite(seatedThickness(draft)) || seatedThickness(draft) <= 0 || seatedThickness(draft) >= BRICK_MM)
    )
  ) {
    return { rows: null, conflicts: [], reason: "unsupported" };
  }
  // A single seated element may cut its course. Assemblies already carry their cuts.
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
    const obstacles = Object.values(workRows)
      .flat()
      .filter((b) => !replacedIds.has(b.id));
    ring = grateRingBricks(singleSeated, seatedThickness(singleSeated), row, singleSeated.id).filter(
      (piece) => isInsideGrid(piece, grid) && !obstacles.some((b) => overlaps3D(piece, b))
    );
  }

  // New elements always use the flush elevation. Never silently drop to the
  // course base when the ledge is too deep or there is no support.
  const drafts = rawDrafts.map((draft) => {
    if (!isSeated(draft)) return { ...draft, ...(draft.custom ? { custom: cloneCustomBrick(draft.custom) } : {}) };
    return {
      ...draft,
      custom: {
        ...(draft.custom ?? { name: "", ...footprintSizeOf({ ...draft, orientation: "h" }), notch: null }),
        seatZMm: BRICK_MM - seatedThickness(draft)
      }
    };
  });

  const internalConflicts = drafts.filter((draft, i) => drafts.some((other, j) => i !== j && overlaps3D(draft, other)));
  if (internalConflicts.length) return { rows: null, conflicts: internalConflicts };

  const conflicts = Object.values(workRows)
    .flat()
    .filter((brick) => drafts.some((draft) => overlaps3D(draft, brick)));

  if (drafts.some((draft) => draft.kind === "plate" || draft.kind === "damper" || draft.kind === "grate")) {
    // Preserve the legacy replace operation; the interactive preview requires erasing first.
    const target = drafts.length === 1 && (drafts[0].kind === "plate" || drafts[0].kind === "grate") ? drafts[0] : null;
    const replaced = new Set(
      target ? baseRow.filter((b) => b.kind === target.kind && overlaps(b, target)).map((b) => b.id) : []
    );
    const blocking = conflicts.filter((brick) => !replaced.has(brick.id));
    if (blocking.length) return { rows: null, conflicts: blocking };
    const remaining = baseRow.filter((brick) => !replaced.has(brick.id));
    const supports = [...remaining, ...ring, ...drafts];
    const unsupported = drafts.filter((draft) => isSeated(draft) && !hasSeat(supports, draft));
    // A second cut may lower the shared ledge of an already seated element.
    const unseated = remaining.filter(
      (brick) => isSeated(brick) && hasSeat(rows[row] ?? [], brick) && !hasSeat(supports, brick)
    );
    if (unsupported.length || unseated.length) {
      const affected = unsupported.length
        ? remaining.filter(
            (brick) =>
              MASONRY_KINDS.has(brick.kind) &&
              unsupported.some((draft) => boxesIntersect(brickBounds(brick), brickBounds(draft)))
          )
        : [];
      return { rows: null, conflicts: [...affected, ...unseated], reason: "unsupported" };
    }
    return { rows: { ...workRows, [row]: [...remaining, ...drafts, ...ring] }, conflicts: [] };
  }

  if (drafts.length === 1) {
    // «тап — заменил» действует только в своём ряду; плиту/задвижку тапом не
    // стираем — их снимают ластиком осознанно
    const blocking = conflicts.filter(
      (brick) => brick.row !== row || brick.kind === "plate" || brick.kind === "damper"
    );
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
  return rowBricks.filter((brick) => brick.kind !== "vent" && !isOverlayKind(brick.kind) && overlaps(brick, damper));
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
export function grateRingBricks(
  grate: BrickFootprint,
  thicknessMm: number,
  row: number,
  idPrefix: string
): PlacedBrick[] {
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
  const split = (len: number, minimum = 1): number[] => {
    const count = Math.max(minimum, Math.ceil(len / 2 - EPS));
    return Array.from({ length: count }, () => len / count);
  };

  for (const side of ["n", "s"] as const) {
    const py = side === "n" ? b.y1 - 0.5 : b.y2 - 0.5;
    let px = b.x1 - 0.5;
    // At least two pieces keep the notch anchored at a corner even for a
    // 125 mm wide grate; one long piece would need a U-shaped cut.
    for (const len of split(b.x2 - b.x1 + 1, 2)) {
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
