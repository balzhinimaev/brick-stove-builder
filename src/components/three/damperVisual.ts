import { damperParts, footprintSizeOf } from "../../domain/geometry";
import type { GridSpec, PlacedBrick } from "../../domain/types";
import { solidSceneBox, type SceneBox } from "./sceneMath";

export type DamperVisualPart = SceneBox & { role: "blade" | "frame" | "guide" | "handle" };

/** Render-only schematic cues. Never used for placement, collisions, quantities or persistence.
 * Derive the motion from the physical blade so local side-slides and rotations stay coherent.
 * Cue widths are illustrative, not hardware specifications.
 */
export function damperVisualParts(brick: PlacedBrick, grid: GridSpec): DamperVisualPart[] {
  const physical = damperParts(brick);
  const result: DamperVisualPart[] = physical.map(({ solid, role }) => ({
    ...solidSceneBox(solid, brick.row, grid),
    role: role === "blade" ? "blade" : "frame"
  }));
  const bladeAt = (open: number) => {
    const part = damperParts({ ...brick, damperOpen: open }).find((p) => p.role === "blade");
    if (!part) throw new Error("Damper has no moving blade");
    return solidSceneBox(part.solid, brick.row, grid);
  };
  const closed = bladeAt(0),
    opened = bladeAt(1);
  const blade = result.find((p) => p.role === "blade");
  if (!blade) return result;
  const motion = [0, 1, 2].reduce((a, b) =>
    Math.abs(opened.position[a] - closed.position[a]) > Math.abs(opened.position[b] - closed.position[b]) ? a : b
  );
  const vertical = brick.custom?.damperPlane === "vertical";
  const localSize = footprintSizeOf({ ...brick, orientation: "h" });
  const broadX = localSize.w >= localSize.h;
  const normal = vertical ? (broadX === (brick.orientation === "h") ? 2 : 0) : 1;
  // Grip projects out of the local front face (up for horizontal gates), rotating with the assembly.
  const normalSign = vertical ? (brick.orientation === "v" && broadX ? 1 : -1) : 1;
  const across = 3 - motion - normal;
  const direction = Math.sign(opened.position[motion] - closed.position[motion]);
  const rail = Math.min(0.08, closed.scale[across] * 0.08, closed.scale[motion] * 0.08);
  const depth = Math.max(closed.scale[normal] * 1.8, rail);
  const add = (role: DamperVisualPart["role"], position: number[], scale: number[]) =>
    result.push({ role, position: position as SceneBox["position"], scale: scale as SceneBox["scale"] });
  // Fixed side guides cover the full travel, connecting the installed opening to the raised/pulled blade.
  for (const side of [-1, 1]) {
    const position = [...closed.position],
      scale = [...closed.scale];
    position[motion] = (closed.position[motion] + opened.position[motion]) / 2;
    position[across] += (side * (closed.scale[across] + rail)) / 2;
    scale[motion] += Math.abs(opened.position[motion] - closed.position[motion]);
    scale[across] = rail;
    scale[normal] = depth;
    add("guide", position, scale);
  }
  // A zero-frame legacy gate gets a visible schematic installation rim, not a new domain frame.
  if (!physical.some((p) => p.role === "frame")) {
    for (const side of [-1, 1]) {
      const position = [...closed.position],
        scale = [...closed.scale];
      position[motion] += (side * (closed.scale[motion] + rail)) / 2;
      scale[motion] = rail;
      scale[across] += rail * 2;
      scale[normal] = depth;
      add("guide", position, scale);
    }
  }
  // U-shaped grip attached to the moving leading edge, proud of the plate on its normal axis.
  const grip = Math.min(0.55, blade.scale[across] * 0.55);
  const lift = Math.max(rail * 2, depth);
  const center = [...blade.position];
  center[motion] += direction * (blade.scale[motion] / 2 - rail);
  for (const side of [-1, 1]) {
    const position = [...center],
      scale = [rail, rail, rail];
    position[across] += (side * grip) / 2;
    position[normal] += normalSign * (blade.scale[normal] / 2 + lift / 2);
    scale[normal] = lift;
    add("handle", position, scale);
  }
  center[normal] += normalSign * (blade.scale[normal] / 2 + lift);
  const scale = [rail, rail, rail];
  scale[across] = grip + rail;
  add("handle", center, scale);
  return result;
}
