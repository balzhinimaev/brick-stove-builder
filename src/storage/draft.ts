import { cloneRows } from "../domain/geometry";
import type { Parameters, PlacedBrick } from "../domain/types";

export type LocalDraft = {
  parameters: Parameters;
  rowCount: number;
  currentRow: number;
  lockedRows: number[];
  rows: Record<number, PlacedBrick[]>;
  updatedAt: number;
};

function draftStorageKey(login: string): string {
  return `brick-stove-draft:${login}`;
}

export function loadLocalDraft(login: string): LocalDraft | null {
  try {
    const raw = localStorage.getItem(draftStorageKey(login));
    if (!raw) return null;
    return JSON.parse(raw) as LocalDraft;
  } catch {
    return null;
  }
}

export function saveLocalDraft(login: string, draft: LocalDraft): void {
  localStorage.setItem(draftStorageKey(login), JSON.stringify({ ...draft, rows: cloneRows(draft.rows) }));
}
