import type { CameraState, Parameters, ToolKind } from "./types";

export const INITIAL_ROWS = 8;

/**
 * One grid cell models a quarter brick of plan footprint: a standard brick is
 * 250×120 mm, and we lay it out on a 12.5 cm square lattice so a horizontal
 * brick spans two cells (≈25 cm) and a vertical one spans two cells the other way.
 */
export const MM_PER_CELL = 125;
export const CELL_CM = MM_PER_CELL / 10;
export const MIN_GRID_COLS = 4;
export const MIN_GRID_ROWS = 4;

/** Height of a single masonry course in 3D world units (≈ one brick-on-edge layer). */
export const BRICK_LAYER_HEIGHT = 0.34;
/** Mortar joint width carved out of every brick footprint in the 3D preview. */
export const BRICK_GAP = 0.035;

export const TOOLS: ToolKind[] = ["standard", "cut", "rebate", "firebrick", "vent", "cleanout", "grate", "plate", "eraser"];

export const DEFAULT_PARAMETERS: Parameters = {
  foundationWidth: 120,
  foundationLength: 160,
  foundationThickness: 25,
  roomHeight: 260
};

export const DEFAULT_CAMERA: CameraState = { zoom: 1, angle: 0, offsetX: 0, offsetY: 0 };
