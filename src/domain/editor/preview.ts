import { brickBounds, isInsideGrid, planPlacement, removeBrickAt } from "../geometry";
import { buildPlacementDrafts } from "./placement";
import type { EditorState } from "./types";
import type { PlacedBrick } from "../types";

export type PlacementPoint = { x: number; y: number; rawX: number; rawY: number };
export type PlacementPreview = {
  status: "ready" | "blocked" | "outside" | "locked" | "empty" | "erase" | "toggle";
  bricks: PlacedBrick[];
  affected: PlacedBrick[];
  adjustments: PlacedBrick[];
};

/** One source of truth for the ghost, confirmation and the placement transaction. */
export function previewPlacement(state: EditorState, point: PlacementPoint): PlacementPreview {
  const empty = { bricks: [], affected: [], adjustments: [] };
  if (state.lockedRows.includes(state.currentRow)) return { ...empty, status: "locked" };
  const current = state.rows[state.currentRow] ?? [];
  if (state.activeTool === "eraser") {
    const remaining = new Set(removeBrickAt(current, point.rawX, point.rawY).map((brick) => brick.id));
    const affected = current.filter((brick) => !remaining.has(brick.id));
    return { ...empty, affected, status: affected.length ? "erase" : "empty" };
  }
  if (state.activeTool === "damper") {
    const hit = current.find((brick) => {
      const b = brickBounds(brick);
      return (
        brick.kind === "damper" && point.rawX >= b.x1 && point.rawX < b.x2 && point.rawY >= b.y1 && point.rawY < b.y2
      );
    });
    if (hit) return { ...empty, affected: [hit], status: "toggle" };
  }
  const drafts = buildPlacementDrafts(state, point.x, point.y, () => 0);
  if (!drafts) return { ...empty, status: "empty" };
  if (drafts.some((brick) => !isInsideGrid(brick, state.grid))) return { ...empty, bricks: drafts, status: "outside" };
  const plan = planPlacement(state.rows, state.currentRow, drafts, state.grid);
  if (!plan.rows) return { ...empty, bricks: drafts, affected: plan.conflicts, status: "blocked" };
  // Interactive placement never silently replaces existing elements. Auto-cuts keep identity.
  const planned = plan.rows[state.currentRow];
  const remaining = new Set(planned.map((brick) => brick.id));
  const removed = current.filter((brick) => !remaining.has(brick.id));
  if (removed.length) return { ...empty, bricks: drafts, affected: removed, status: "blocked" };
  const original = new Map(current.map((brick) => [brick.id, brick]));
  const ids = new Set(drafts.map((brick) => brick.id));
  return {
    bricks: planned.filter((brick) => ids.has(brick.id)),
    adjustments: planned.filter((brick) => !ids.has(brick.id) && original.get(brick.id) !== brick),
    affected: [],
    status: "ready"
  };
}

export function canConfirmPlacement(preview: PlacementPreview): boolean {
  return preview.status === "ready" || preview.status === "erase" || preview.status === "toggle";
}
