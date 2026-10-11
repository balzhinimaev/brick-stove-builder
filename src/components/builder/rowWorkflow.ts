import type { PlacedBrick } from "../../domain/types";

export type RowContext = {
  rows: Record<number, PlacedBrick[]>;
  currentRow: number;
  rowCount: number;
  lockedRows: number[];
  sceneRevision?: number;
  busy: boolean;
};
export type RowAction = "copyPreviousRow" | "clearCurrentRow" | "deleteCurrentRow";
export type PendingRowAction = { action: RowAction; context: RowContext; trigger: HTMLElement | null };
export function confirmationValid(pending: PendingRowAction, now: RowContext) {
  const before = pending.context;
  return (
    !now.busy &&
    !now.lockedRows.includes(now.currentRow) &&
    before.rows === now.rows &&
    before.currentRow === now.currentRow &&
    before.rowCount === now.rowCount &&
    before.lockedRows === now.lockedRows &&
    before.sceneRevision === now.sceneRevision
  );
}
export function rowPage(
  rows: Record<number, PlacedBrick[]>,
  count: number,
  current: number,
  locked: number[],
  filter: string
) {
  const matching = Array.from({ length: count }, (_, i) => i + 1).filter(
    (row) =>
      row === current || filter === "all" || (filter === "nonempty" ? !!rows[row]?.length : !locked.includes(row))
  );
  const start = Math.floor(matching.indexOf(current) / 12) * 12;
  return {
    visible: matching.slice(start, start + 12),
    total: matching.length,
    previous: matching[start - 1],
    next: matching[start + 12]
  };
}
export function rowShortcut(
  event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "isComposing" | "target">,
  current: number,
  count: number,
  blocked: boolean
) {
  const target = event.target as HTMLElement | null;
  if (
    blocked ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey ||
    target?.isContentEditable ||
    target?.closest?.("input,textarea,select,dialog,[role=dialog]")
  )
    return null;
  if (event.key !== "PageUp" && event.key !== "PageDown") return null;
  return Math.max(1, Math.min(count, current + (event.key === "PageUp" ? -1 : 1)));
}

/** Native dialog owns focus trapping and Escape; cleanup also covers stale-context unmounts. */
export function openRowDialog(
  dialog: Pick<HTMLDialogElement, "showModal" | "close">,
  cancel: Pick<HTMLElement, "focus">,
  trigger: Pick<HTMLElement, "focus" | "isConnected"> | null
) {
  dialog.showModal();
  cancel.focus();
  return () => {
    dialog.close();
    if (trigger?.isConnected) trigger.focus();
  };
}
