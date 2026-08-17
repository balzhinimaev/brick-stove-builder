import type { GridSpec, Orientation, PlacedBrick } from "../types";
import { isInsideGrid } from "./bounds";
import { overlaps, overlaps3D } from "./collisions";

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
