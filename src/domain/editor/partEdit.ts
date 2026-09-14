import { isInsideGrid, overlaps3D } from "../geometry";
import { validateSnapshot } from "../../storage/projectFile";
import type { PlacedBrick } from "../types";
import type { EditorState } from "./types";
import { masonryDimensions, isMasonryPiece } from "../masonryAudit";

/** Resize a masonry shape in its local frame, preserving notches and the base of raised profiles. */
export function resizedMasonry(brick: PlacedBrick, worldDimensions: number[]): PlacedBrick {
  if (!isMasonryPiece(brick)) throw new Error("Размеры арматуры задаются её специальным инструментом");
  if (worldDimensions.length !== 3 || worldDimensions.some((n) => !Number.isFinite(n) || n <= 0 || n > 10000))
    throw new Error("Размеры должны быть положительными, до 10 000 мм");
  const before = masonryDimensions(brick);
  if (before.every((n, i) => Math.abs(n - worldDimensions[i]) < 1e-6)) return brick;
  if (brick.kind === "rebate" && !brick.custom)
    throw new Error("Для четверти используйте резак; перемещение и поворот доступны здесь");
  const local =
    brick.orientation === "h" ? worldDimensions : [worldDimensions[1], worldDimensions[0], worldDimensions[2]];
  const old = brick.orientation === "h" ? before : [before[1], before[0], before[2]];
  const [sx, sy, sz] = local.map((n, i) => n / old[i]);
  const c = brick.custom;
  const next = c
    ? structuredClone(c)
    : {
        name: "Подрезка",
        w: local[0] / 125,
        h: local[1] / 125,
        cutFrom: brick.kind === "firebrick" ? ("firebrick" as const) : ("standard" as const)
      };
  next.w = local[0] / 125;
  next.h = local[1] / 125;
  if (next.solidParts) {
    const base = Math.min(...next.solidParts.map((p) => p.z1));
    next.solidParts = next.solidParts.map((p) => ({
      x1: p.x1 * sx,
      x2: p.x2 * sx,
      y1: p.y1 * sy,
      y2: p.y2 * sy,
      z1: base + (p.z1 - base) * sz,
      z2: base + (p.z2 - base) * sz
    }));
  } else if (next.profileXZ) {
    const base = Math.min(...next.profileXZ.map((p) => p.z));
    next.profileXZ = next.profileXZ.map((p) => ({ x: p.x * sx, z: base + (p.z - base) * sz }));
  } else {
    next.heightMm = local[2];
    if (next.notch)
      next.notch = { x1: next.notch.x1 * sx, x2: next.notch.x2 * sx, y1: next.notch.y1 * sy, y2: next.notch.y2 * sy };
    if (next.notchDepthMm !== undefined) next.notchDepthMm *= sz;
  }
  return { ...brick, kind: "custom", custom: next };
}

export function partEditError(
  state: Pick<EditorState, "rows" | "grid" | "parameters" | "rowCount" | "lockedRows" | "currentRow">,
  originalId: string,
  candidate: PlacedBrick,
  duplicate = false
): string | null {
  const original = Object.values(state.rows)
    .flat()
    .find((b) => b.id === originalId);
  if (!original) return "Деталь больше не существует";
  if (state.lockedRows.includes(original.row) || state.lockedRows.includes(candidate.row))
    return "Сначала разблокируйте исходный и целевой ряды";
  try {
    validateSnapshot({ ...state, rows: { [candidate.row]: [candidate] } });
  } catch (e) {
    return e instanceof Error ? e.message : "Некорректная форма";
  }
  if (!isInsideGrid(candidate, state.grid)) return "Деталь выходит за пределы основания";
  const others = Object.values(state.rows)
    .flat()
    .filter((b) => duplicate || b.id !== originalId);
  const collision = others.find((b) => overlaps3D(candidate, b));
  return collision ? `Пересечение с деталью ${collision.id}, ряд ${collision.row}. Изменение не применено.` : null;
}
