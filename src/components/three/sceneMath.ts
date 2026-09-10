import { BRICK_GAP, MM_PER_CELL } from "../../domain/constants";
import { brickBounds, brickSolids, brickPhysicalSolids, cellToWorld, type BrickSolid } from "../../domain/geometry";
import type { GridSpec, PlacedBrick } from "../../domain/types";
import type { PlacementPoint, PlacementPreview } from "../../domain/editor/preview";

export type SceneBox = { position: [number, number, number]; scale: [number, number, number] };

/** Show the planned cut instead of drawing its ghost inside the original solid brick. */
export function withPlacementAdjustments(bricks: PlacedBrick[], preview: PlacementPreview | null): PlacedBrick[] {
  if (preview?.status !== "ready" || !preview.adjustments.length) return bricks;
  const adjustments = new Map(preview.adjustments.map((brick) => [brick.id, brick]));
  const existing = new Set(bricks.map((brick) => brick.id));
  return [
    ...bricks.map((brick) => adjustments.get(brick.id) ?? brick),
    ...preview.adjustments.filter((brick) => !existing.has(brick.id))
  ];
}

/** Render the same occupied solids as collision detection, including ledges and metal seats. */
export function solidBoxes(brick: PlacedBrick, grid: GridSpec, mortarGap = BRICK_GAP): SceneBox[] {
  const outer = brickBounds(brick);
  if (brick.custom?.damperPlane === "vertical")
    return brickPhysicalSolids(brick).map((solid) => solidSceneBox(solid, brick.row, grid));
  return brickSolids(brick).map(({ box, z1, z2 }) => {
    // Shave external faces only; never split an L-shaped brick with a fake joint.
    const x1 = box.x1 + (box.x1 === outer.x1 ? mortarGap / 2 : 0);
    const x2 = box.x2 - (box.x2 === outer.x2 ? mortarGap / 2 : 0);
    const y1 = box.y1 + (box.y1 === outer.y1 ? mortarGap / 2 : 0);
    const y2 = box.y2 - (box.y2 === outer.y2 ? mortarGap / 2 : 0);
    const center = cellToWorld((x1 + x2) / 2, (y1 + y2) / 2, grid);
    return {
      position: [center.x, ((brick.row - 1) * 70 + (z1 + z2) / 2) / MM_PER_CELL, center.z],
      scale: [Math.max(0.002, x2 - x1), (z2 - z1) / MM_PER_CELL, Math.max(0.002, y2 - y1)]
    };
  });
}

/** Floor coordinates stay in the unrotated document frame. Never clamp an outside tap into the model. */
export function placementPoint(worldX: number, worldZ: number, grid: GridSpec, step: number): PlacementPoint | null {
  const rawX = worldX + grid.cols / 2;
  const rawY = worldZ + grid.rows / 2;
  if (rawX < 0 || rawY < 0 || rawX >= grid.cols || rawY >= grid.rows) return null;
  return { x: Math.floor(rawX / step) * step, y: Math.floor(rawY / step) * step, rawX, rawY };
}

export function nudgePoint(point: PlacementPoint, dx: number, dy: number): PlacementPoint {
  return { x: point.x + dx, y: point.y + dy, rawX: point.rawX + dx, rawY: point.rawY + dy };
}

/** Cutter dimensions are in millimetres and need not land on the coarse placement grid. */
export function setPointCoordinateMm(point: PlacementPoint, axis: "x" | "y", mm: number): PlacementPoint {
  if (!Number.isFinite(mm)) return point;
  const value = mm / MM_PER_CELL;
  return axis === "x" ? { ...point, x: value, rawX: value } : { ...point, y: value, rawY: value };
}

/** Sphere fitting works for tall models and narrow portrait canvases at every orbit angle. */
export function fittedDistance(width: number, depth: number, height: number, aspect: number, fov: number): number {
  const vertical = (fov * Math.PI) / 360;
  const horizontal = Math.atan(Math.tan(vertical) * Math.max(0.1, aspect));
  const radius = Math.hypot(width, depth, height) / 2;
  return (radius / Math.sin(Math.min(vertical, horizontal))) * 1.12;
}

/** A cancelled, dragged or multi-pointer sequence must never select a placement. */
export class PlacementGesture {
  private pointers = new Set<number>();
  private start: { x: number; y: number } | null = null;
  private cancelled = false;
  down(id: number, x: number, y: number) {
    this.pointers.add(id);
    if (this.pointers.size === 1) {
      this.start = { x, y };
      this.cancelled = false;
    } else this.cancelled = true;
  }
  move(x: number, y: number) {
    if (this.start && Math.hypot(x - this.start.x, y - this.start.y) > 6) this.cancelled = true;
  }
  up(id: number, x: number, y: number): boolean {
    this.move(x, y);
    const tap = this.pointers.has(id) && this.pointers.size === 1 && !this.cancelled;
    this.pointers.delete(id);
    if (!this.pointers.size) this.start = null;
    return tap;
  }
  cancel() {
    this.pointers.clear();
    this.start = null;
    this.cancelled = true;
  }
}

/** Exact physical part box, no cosmetic mortar shaving. Profiles must use their mesh, not this bound. */
export function solidSceneBox({ box, z1, z2 }: BrickSolid, row: number, grid: GridSpec): SceneBox {
  const center = cellToWorld((box.x1 + box.x2) / 2, (box.y1 + box.y2) / 2, grid);
  return {
    position: [center.x, ((row - 1) * 70 + (z1 + z2) / 2) / MM_PER_CELL, center.z],
    scale: [box.x2 - box.x1, (z2 - z1) / MM_PER_CELL, box.y2 - box.y1]
  };
}
