import { Color } from "three";
import { isSteelPart } from "../../domain/materials";
import type { PlacedBrick } from "../../domain/types";

const METAL_KINDS = new Set(["plate", "grate", "damper", "cleanout"]);
export const isMasonry = (brick: PlacedBrick): boolean =>
  !METAL_KINDS.has(brick.kind) && brick.kind !== "vent" && !isSteelPart(brick);

/** The same appearance feeds rectangular and convex custom parts. Steel never receives brick texture or mortar. */
export function brickAppearance(brick: PlacedBrick) {
  if (isSteelPart(brick)) return { color: new Color("#535c62"), roughness: 0.55, metalness: 0.75 };
  const seed = [...brick.id].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
  const fire = brick.kind === "firebrick" || brick.custom?.cutFrom === "firebrick";
  return {
    color: new Color(fire ? "#c8ad79" : "#a95b40").multiplyScalar(0.88 + (seed % 100) / 420),
    roughness: 0.92,
    metalness: 0
  };
}
