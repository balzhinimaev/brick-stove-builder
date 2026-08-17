import { brickSizeFor } from "../geometry";
import type { PlacedBrick } from "../types";
import type { PlacementSelection } from "./types";

export function buildPlacementDrafts(sel: PlacementSelection, x: number, y: number, nextId: () => number): PlacedBrick[] | null {
  if (sel.activeTool === "eraser") return null;
  const brick: PlacedBrick = { id: `r${sel.currentRow}-${nextId()}-${x}-${y}`, row: sel.currentRow, x, y, kind: sel.activeTool, orientation: sel.orientation };
  if (sel.activeTool === "grate") brick.custom = sel.grateSpec;
  if (sel.activeTool === "rebate") {
    brick.notchCorner = sel.notchCorner;
    const size = brickSizeFor("rebate", "h");
    brick.custom = { name: "", w: size.w, h: size.h, notch: null, notchDepthMm: sel.rebateDepthMm };
  }
  if (sel.activeTool === "custom") {
    if (!sel.customBrick) return null;
    brick.custom = sel.customBrick;
  }
  if (sel.activeTool === "plate") brick.custom = sel.plateSpec;
  if (sel.activeTool === "cleanout") brick.custom = sel.doorSpec;
  if (sel.activeTool === "damper") {
    brick.custom = sel.damperSpec;
    brick.damperOpen = 0;
  }
  return [brick];
}
