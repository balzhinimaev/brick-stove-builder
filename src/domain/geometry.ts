import { BRICK_GAP, BRICK_LAYER_HEIGHT, CELL_CM, MIN_GRID_COLS, MIN_GRID_ROWS } from "./constants";
import type { BrickFootprint, GridSpec, Orientation, Parameters, PlacedBrick } from "./types";

export function gridFromParameters(parameters: Parameters): GridSpec {
  const cols = Math.max(MIN_GRID_COLS, Math.round(parameters.foundationWidth / CELL_CM));
  const rows = Math.max(MIN_GRID_ROWS, Math.round(parameters.foundationLength / CELL_CM));
  return { cols, rows, widthCm: parameters.foundationWidth, lengthCm: parameters.foundationLength };
}

export type BrickSize = { w: number; h: number };

export function brickSizeFor(kind: BrickFootprint["kind"], orientation: Orientation): BrickSize {
  if (kind === "grate") return orientation === "h" ? { w: 3, h: 2 } : { w: 2, h: 3 };
  if (kind === "trim") return orientation === "h" ? { w: 0.5, h: 1 } : { w: 1, h: 0.5 };
  const isCutLike = kind === "cut" || kind === "cleanout";
  if (orientation === "h") return { w: isCutLike ? 1 : 2, h: 1 };
  return { w: 1, h: isCutLike ? 1 : 2 };
}

export type BrickBox = { x1: number; y1: number; x2: number; y2: number };

export function brickBounds(brick: BrickFootprint): BrickBox {
  const size = brickSizeFor(brick.kind, brick.orientation);
  return { x1: brick.x, y1: brick.y, x2: brick.x + size.w, y2: brick.y + size.h };
}

export function isInsideGrid(brick: BrickFootprint, grid: GridSpec): boolean {
  const b = brickBounds(brick);
  return b.x1 >= 0 && b.y1 >= 0 && b.x2 <= grid.cols && b.y2 <= grid.rows;
}

/**
 * Axis-aligned bounding-box overlap. O(1) per pair and, unlike a cell-occupancy
 * Set, it stays correct for half-cell `trim`/`cut` footprints.
 */
export function overlaps(a: BrickFootprint, b: BrickFootprint): boolean {
  const aa = brickBounds(a);
  const bb = brickBounds(b);
  return aa.x1 < bb.x2 && aa.x2 > bb.x1 && aa.y1 < bb.y2 && aa.y2 > bb.y1;
}

export function placeBrickInRow(rowBricks: PlacedBrick[], draft: PlacedBrick, grid: GridSpec): PlacedBrick[] {
  if (!isInsideGrid(draft, grid)) return rowBricks;
  return [...rowBricks.filter((brick) => !overlaps(brick, draft)), draft];
}

export function placeBricksInRow(rowBricks: PlacedBrick[], drafts: PlacedBrick[], grid: GridSpec): PlacedBrick[] {
  if (!drafts.length) return rowBricks;
  if (drafts.some((draft) => !isInsideGrid(draft, grid))) return rowBricks;
  return [...rowBricks.filter((brick) => !drafts.some((draft) => overlaps(brick, draft))), ...drafts];
}

export function grateAssemblyBricks(row: number, x: number, y: number, orientation: Orientation, nextId: () => number): PlacedBrick[] {
  const grate: PlacedBrick = { id: `r${row}-${nextId()}-${x}-${y}`, row, x, y, kind: "grate", orientation };
  if (orientation === "h") {
    return [
      grate,
      { id: `r${row}-${nextId()}-${x - 0.5}-${y}`, row, x: x - 0.5, y, kind: "trim", orientation: "h" },
      { id: `r${row}-${nextId()}-${x - 0.5}-${y + 1}`, row, x: x - 0.5, y: y + 1, kind: "trim", orientation: "h" },
      { id: `r${row}-${nextId()}-${x + 3}-${y}`, row, x: x + 3, y, kind: "trim", orientation: "h" },
      { id: `r${row}-${nextId()}-${x + 3}-${y + 1}`, row, x: x + 3, y: y + 1, kind: "trim", orientation: "h" }
    ];
  }
  return [
    grate,
    { id: `r${row}-${nextId()}-${x}-${y - 0.5}`, row, x, y: y - 0.5, kind: "trim", orientation: "v" },
    { id: `r${row}-${nextId()}-${x + 1}-${y - 0.5}`, row, x: x + 1, y: y - 0.5, kind: "trim", orientation: "v" },
    { id: `r${row}-${nextId()}-${x}-${y + 3}`, row, x, y: y + 3, kind: "trim", orientation: "v" },
    { id: `r${row}-${nextId()}-${x + 1}-${y + 3}`, row, x: x + 1, y: y + 3, kind: "trim", orientation: "v" }
  ];
}

export function pruneRowsToGrid(rows: Record<number, PlacedBrick[]>, grid: GridSpec): Record<number, PlacedBrick[]> {
  return Object.fromEntries(
    Object.entries(rows).map(([row, bricks]) => [row, bricks.filter((brick) => isInsideGrid(brick, grid))])
  ) as Record<number, PlacedBrick[]>;
}

export function removeBrickAt(rowBricks: PlacedBrick[], x: number, y: number): PlacedBrick[] {
  return rowBricks.filter((brick) => {
    const b = brickBounds(brick);
    return !(x >= b.x1 && x < b.x2 && y >= b.y1 && y < b.y2);
  });
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

export function brickWorldGeometry(brick: Pick<PlacedBrick, "x" | "y" | "row" | "kind" | "orientation">, grid: GridSpec): BrickWorldGeometry {
  const size = brickSizeFor(brick.kind, brick.orientation);
  const center = cellToWorld(brick.x + size.w / 2, brick.y + size.h / 2, grid);
  const y = (brick.row - 0.5) * BRICK_LAYER_HEIGHT;
  return {
    position: [center.x, y, center.z],
    scale: [Math.max(0.1, size.w - BRICK_GAP), BRICK_LAYER_HEIGHT * 0.92, Math.max(0.1, size.h - BRICK_GAP)]
  };
}
