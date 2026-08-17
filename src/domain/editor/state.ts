import { DEFAULT_CAMERA, DEFAULT_PARAMETERS, INITIAL_ROWS } from "../constants";
import { gridFromParameters } from "../geometry";
import { makeDemoRows } from "../projects";
import { DEFAULT_DAMPER, DEFAULT_DOOR, DEFAULT_GRATE, DEFAULT_PLATE, DEFAULT_REBATE_DEPTH_MM } from "./specs";
import type { EditorState } from "./types";

export function initialEditorState(): EditorState {
  return {
    parameters: DEFAULT_PARAMETERS,
    grid: gridFromParameters(DEFAULT_PARAMETERS),
    rowCount: INITIAL_ROWS,
    currentRow: 2,
    lockedRows: [1],
    rows: makeDemoRows(),
    activeTool: "standard",
    orientation: "h",
    notchCorner: "ne",
    rebateDepthMm: DEFAULT_REBATE_DEPTH_MM,
    snapStep: 1,
    customBrick: null,
    plateSpec: DEFAULT_PLATE,
    doorSpec: DEFAULT_DOOR,
    damperSpec: DEFAULT_DAMPER,
    grateSpec: DEFAULT_GRATE,
    viewMode: "3d",
    camera: DEFAULT_CAMERA
  };
}
