import { describe, expect, it } from "vitest";
import { RUSSIAN_STOVE } from "../russianStove";
import {
  BRICK_MM,
  COURSE_MM,
  GEOMETRY_EPS,
  boxesIntersect,
  brickSolids,
  gridFromParameters,
  isInsideGrid,
  overlaps3D,
  cloneRows
} from "../geometry";
import type { BrickSolid } from "../geometry";
import type { PlacedBrick } from "../types";

const bricks = Object.values(RUSSIAN_STOVE.rows).flat();

const worldSolids = (brick: PlacedBrick): BrickSolid[] =>
  brickSolids(brick).map((solid) => ({
    ...solid,
    z1: (brick.row - 1) * COURSE_MM + solid.z1,
    z2: (brick.row - 1) * COURSE_MM + solid.z2
  }));

/** Geometric contact only: this does not calculate cantilever or arch strength. */
function unsupportedMasonry(elements: PlacedBrick[]): PlacedBrick[] {
  const masonry = elements
    .filter((brick) => !["plate", "grate", "damper", "cleanout", "vent"].includes(brick.kind))
    .map((brick) => ({ brick, occupied: worldSolids(brick) }));
  const supported = new Set<string>();
  // A support's top cannot exceed the supported bottom, so its bottom is lower:
  // processing bottom-up proves the complete contact chain, not just one course.
  const bottom = (entry: (typeof masonry)[number]) => Math.min(...entry.occupied.map((solid) => solid.z1));
  const ordered = [...masonry].sort((a, b) => bottom(a) - bottom(b));
  for (const entry of ordered) {
    const { brick, occupied } = entry;
    if (bottom(entry) <= GEOMETRY_EPS) {
      supported.add(brick.id);
      continue;
    }
    const contactsFoundation = masonry.some(
      (lower) =>
        supported.has(lower.brick.id) &&
        occupied.some((upperSolid) =>
          lower.occupied.some((lowerSolid) => {
            const gap = upperSolid.z1 - lowerSolid.z2;
            return (
              gap >= -GEOMETRY_EPS &&
              gap <= COURSE_MM - BRICK_MM + GEOMETRY_EPS &&
              boxesIntersect(upperSolid.box, lowerSolid.box)
            );
          })
        )
    );
    if (contactsFoundation) supported.add(brick.id);
  }
  return masonry.filter(({ brick }) => !supported.has(brick.id)).map(({ brick }) => brick);
}

type GasCell = { row: number; x: number; y: number };
const cellKey = ({ row, x, y }: GasCell) => `${row}:${x}:${y}`;

/**
 * Only named internal spaces may carry a path; never flood through the room
 * outside an open mouth and back into the chimney. Solid intersections use the
 * WHOLE course, so a 15 mm hob cannot disappear between midpoint samples.
 * Whole-course blocking also prevents treating the 5 mm mortar seam as a flue.
 */
function gasGraph(elements: PlacedBrick[]): Map<string, GasCell> {
  const cells = new Map<string, GasCell>();
  const region = (r1: number, r2: number, x1: number, x2: number, y1: number, y2: number) => {
    for (let row = r1; row <= r2; row++)
      for (let x = x1; x <= x2; x++)
        for (let y = y1; y <= y2; y++) {
          const cell = { row, x, y };
          cells.set(cellKey(cell), cell);
        }
  };
  region(13, 25, 3, 10, 3, 10); // Cooking chamber, including its narrowing vault.
  region(13, 20, 5, 8, 11, 11); // Mouth between the cooking chamber and smoke hood.
  region(13, 25, 4, 9, 12, 14); // Hood; its enclosing masonry rejects edge cells.
  region(26, 36, 6, 7, 12, 13); // Chimney interior, not the exterior of its shaft.
  region(6, 12, 5, 8, 13, 14); // Hob firebox up to and INCLUDING its sealing plate.
  region(10, 11, 9, 10, 13, 14); // Side outlet from the hob firebox.
  region(10, 21, 11, 11, 13, 14); // Separate vertical hob exhaust.
  region(21, 21, 10, 10, 13, 13); // Lateral opening into the smoke hood.

  const obstacles = elements.flatMap((brick) => {
    // The engine uses a full bounding box for the damper frame, not the moving
    // blade's aperture. Only an explicitly open damper is a designated portal.
    if (brick.kind === "vent" || (brick.kind === "damper" && (brick.damperOpen ?? 0) > 0)) return [];
    return worldSolids(brick);
  });
  for (const [key, { row, x, y }] of cells) {
    const z1 = (row - 1) * COURSE_MM;
    const z2 = row * COURSE_MM;
    const box = { x1: x, x2: x + 1, y1: y, y2: y + 1 };
    if (
      obstacles.some(
        (solid) => boxesIntersect(solid.box, box) && Math.min(solid.z2, z2) - Math.max(solid.z1, z1) > GEOMETRY_EPS
      )
    )
      cells.delete(key);
  }
  return cells;
}

function hasGasRoute(cells: Map<string, GasCell>, start: GasCell, destination: GasCell): boolean {
  const startKey = cellKey(start);
  const targetKey = cellKey(destination);
  if (!cells.has(startKey) || !cells.has(targetKey)) return false;
  const visited = new Set([startKey]);
  const pending = [start];
  for (let index = 0; index < pending.length; index++) {
    const { row, x, y } = pending[index];
    if (cellKey(pending[index]) === targetKey) return true;
    for (const [dr, dx, dy] of [
      [-1, 0, 0],
      [1, 0, 0],
      [0, -1, 0],
      [0, 1, 0],
      [0, 0, -1],
      [0, 0, 1]
    ]) {
      const next = { row: row + dr, x: x + dx, y: y + dy };
      const key = cellKey(next);
      if (cells.has(key) && !visited.has(key)) {
        visited.add(key);
        pending.push(next);
      }
    }
  }
  return false;
}

const hobFirebox: GasCell = { row: 10, x: 6, y: 13 };
const cookingChamber: GasCell = { row: 18, x: 6, y: 6 };
const chimneyTop: GasCell = { row: 36, x: 6, y: 12 };

describe("Russian stove demonstration", () => {
  it("has 36 nonempty editable courses, unique IDs and fits its foundation", () => {
    expect(Object.keys(RUSSIAN_STOVE.rows)).toHaveLength(36);
    expect(RUSSIAN_STOVE.lockedRows).toEqual([]);
    expect(new Set(bricks.map((brick) => brick.id)).size).toBe(bricks.length);
    const grid = gridFromParameters(RUSSIAN_STOVE.parameters);
    for (let row = 1; row <= 36; row++) {
      expect(RUSSIAN_STOVE.rows[row].length).toBeGreaterThan(0);
      for (const brick of RUSSIAN_STOVE.rows[row]) {
        expect(brick.row).toBe(row);
        expect(isInsideGrid(brick, grid)).toBe(true);
      }
    }
  });
  it("has no occupied 3D intersections, including tall doors and seats", () => {
    const collisions: string[] = [];
    for (let a = 0; a < bricks.length; a++)
      for (let b = a + 1; b < bricks.length; b++) {
        if (Math.abs(bricks[a].row - bricks[b].row) > 4) continue;
        if (overlaps3D(bricks[a], bricks[b]))
          collisions.push(`${bricks[a].row}:${bricks[a].id} / ${bricks[b].row}:${bricks[b].id}`);
      }
    expect(collisions).toEqual([]);
  });
  it("keeps hardware and the chamber, mouth and chimney voids", () => {
    for (const kind of ["plate", "grate", "damper"]) expect(bricks.filter((b) => b.kind === kind)).toHaveLength(1);
    expect(bricks.filter((b) => b.kind === "cleanout")).toHaveLength(2);
    const point = (row: number, x: number, y: number) => ({
      id: "probe",
      row,
      x,
      y,
      kind: "cut" as const,
      orientation: "h" as const
    });
    for (let row = 13; row <= 20; row++) {
      expect(bricks.some((b) => overlaps3D(b, point(row, 6, 6)))).toBe(false);
      if (row <= 18) expect(bricks.some((b) => overlaps3D(b, point(row, 6, 11)))).toBe(false);
    }
    for (let row = 26; row <= 36; row++)
      if (row !== 29) {
        expect(bricks.some((b) => overlaps3D(b, point(row, 6, 12)))).toBe(false);
      }
  });
  it("connects every masonry element to the base through occupied supporting faces", () => {
    const unsupported = unsupportedMasonry(bricks).map((brick) => `${brick.row}:${brick.id} (${brick.x},${brick.y})`);
    expect(unsupported).toEqual([]);
  });
  it("does not mistake a floating stack or hardware for masonry support", () => {
    const floatingStack = bricks.filter((brick) => brick.row !== 2);
    expect(unsupportedMasonry(floatingStack).some((brick) => brick.row === 36)).toBe(true);
    const supportedByDoor: PlacedBrick[] = [
      {
        id: "door",
        row: 1,
        x: 1,
        y: 1,
        kind: "cleanout",
        orientation: "h",
        custom: { name: "Door", w: 2, h: 1, heightMm: 135 }
      },
      { id: "floating", row: 3, x: 1, y: 1, kind: "standard", orientation: "h" }
    ];
    expect(unsupportedMasonry(supportedByDoor).map((brick) => brick.id)).toEqual(["floating"]);
  });
  it("connects both firing spaces to the chimney without using outside air", () => {
    const cells = gasGraph(bricks);
    expect(hasGasRoute(cells, cookingChamber, chimneyTop), "cooking chamber to chimney").toBe(true);
    expect(hasGasRoute(cells, hobFirebox, chimneyTop), "hob firebox to chimney").toBe(true);
    expect(cells.has(cellKey({ row: 12, x: 6, y: 13 })), "thin plate blocks the whole cell").toBe(false);
  });
  it("detects a plugged hob exhaust instead of finding a false route through the thin plate", () => {
    const plug: PlacedBrick = {
      id: "exhaust-plug",
      row: 15,
      x: 11,
      y: 13,
      kind: "custom",
      orientation: "h",
      custom: { name: "Blocked flue regression", w: 1, h: 2 }
    };
    const sealed = [...bricks, plug];
    expect(hasGasRoute(gasGraph(sealed), hobFirebox, chimneyTop)).toBe(false);
    // Prove this regression is sensitive to the thin plate itself: without it
    // the hob firebox has a direct vertical shortcut into the hood.
    expect(hasGasRoute(gasGraph(sealed.filter((brick) => brick.kind !== "plate")), hobFirebox, chimneyTop)).toBe(true);
  });
  it("only treats the declared open damper as a portal", () => {
    const damper = bricks.find((brick) => brick.kind === "damper");
    if (!damper) throw new Error("The model must include a damper");
    expect(damper.damperOpen).toBeGreaterThan(0);
    const closed = gasGraph(bricks.map((brick) => (brick.id === damper.id ? { ...brick, damperOpen: 0 } : brick)));
    expect(hasGasRoute(closed, cookingChamber, chimneyTop)).toBe(false);
    expect(hasGasRoute(closed, hobFirebox, chimneyTop)).toBe(false);
  });
  it("requires the internal mouth connection for the cooking chamber, not the separate hob exhaust", () => {
    const mouthPlugs: PlacedBrick[] = Array.from({ length: 8 }, (_, index) => ({
      id: `mouth-plug-${index}`,
      row: 13 + index,
      x: 5,
      y: 11,
      kind: "custom",
      orientation: "h",
      custom: { name: "Blocked mouth regression", w: 4, h: 1 }
    }));
    const closedMouth = gasGraph([...bricks, ...mouthPlugs]);
    expect(hasGasRoute(closedMouth, cookingChamber, chimneyTop)).toBe(false);
    expect(hasGasRoute(closedMouth, hobFirebox, chimneyTop)).toBe(true);
  });
  it("clones without modifying the public template", () => {
    const rows = cloneRows(RUSSIAN_STOVE.rows);
    rows[1][0].x = 99;
    const plate = rows[12].find((b) => b.kind === "plate");
    if (!plate?.custom) throw new Error("The cloned model must include the custom hob plate");
    plate.custom.w = 1;
    expect(RUSSIAN_STOVE.rows[1][0].x).not.toBe(99);
    expect(RUSSIAN_STOVE.rows[12].find((b) => b.kind === "plate")?.custom?.w).toBe(5);
  });
});
