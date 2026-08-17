import type { GridSpec, PlacedBrick } from "../types";
import { brickBounds, brickBoxes, isInsideGrid } from "./bounds";
import { isOverlayKind } from "./collisions";

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
