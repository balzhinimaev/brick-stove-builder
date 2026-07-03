import type { CustomBrickSpec } from "../domain/types";

export type StoredCustomBrick = { id: string; spec: CustomBrickSpec };

function storageKey(login: string): string {
  return `brick-stove-custom-bricks:${login || "anon"}`;
}

export function loadCustomBricks(login: string): StoredCustomBrick[] {
  try {
    const raw = localStorage.getItem(storageKey(login));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredCustomBrick[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomBricks(login: string, bricks: StoredCustomBrick[]): void {
  localStorage.setItem(storageKey(login), JSON.stringify(bricks));
}
