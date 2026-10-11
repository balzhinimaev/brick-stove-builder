import { damperParts } from "../../domain/geometry";
import type { GridSpec, PlacedBrick } from "../../domain/types";
import { solidSceneBox, type SceneBox } from "./sceneMath";

export type DamperVisualPart = SceneBox & { role: "blade" | "frame" | "guide" };
/** Physical boxes plus a selected-only closed-blade outline. The outline is NOT a hardware frame.
 * Never use this helper for collision, section caps, raycasting, quantities or persistence. */
export function damperVisualParts(brick: PlacedBrick, grid: GridSpec): DamperVisualPart[] {
  const result: DamperVisualPart[] = damperParts(brick).map(({ solid, role }) => ({
    ...solidSceneBox(solid, brick.row, grid),
    role: role === "blade" ? "blade" : "frame"
  }));
  const closed = damperParts({ ...brick, damperOpen: 0 }).find((p) => p.role === "blade");
  if (closed) result.push({ ...solidSceneBox(closed.solid, brick.row, grid), role: "guide" });
  return result;
}
