import { DEFAULT_CAMERA, DEFAULT_PARAMETERS, INITIAL_ROWS } from "./constants";
import { cloneRows, gridFromParameters, placeBricksInRow, pruneRowsToGrid, removeBrickAt } from "./geometry";
import { PARAM_BOUNDS, clamp } from "./parameters";
import { makeDemoRows } from "./projects";
import type {
  CameraState,
  GridSpec,
  Orientation,
  Parameters,
  PlacedBrick,
  ReadyProject,
  ToolKind,
  ViewMode
} from "./types";

/**
 * The editor document plus current selections. Kept framework-free so every
 * transition is a pure function of (state, action) and can be unit-tested
 * without React.
 */
export type EditorState = {
  parameters: Parameters;
  grid: GridSpec;
  rowCount: number;
  currentRow: number;
  lockedRows: number[];
  rows: Record<number, PlacedBrick[]>;
  activeTool: ToolKind;
  orientation: Orientation;
  viewMode: ViewMode;
  camera: CameraState;
};

export type DraftSnapshot = {
  parameters: Parameters;
  rowCount: number;
  currentRow: number;
  lockedRows: number[];
  rows: Record<number, PlacedBrick[]>;
};

export type EditorAction =
  | { type: "setCurrentRow"; row: number }
  | { type: "setTool"; tool: ToolKind }
  | { type: "setOrientation"; orientation: Orientation }
  | { type: "setViewMode"; mode: ViewMode }
  | { type: "updateParameter"; key: keyof Parameters; value: number }
  | { type: "reset" }
  | { type: "loadProject"; project: ReadyProject }
  | { type: "loadDraft"; draft: DraftSnapshot }
  | { type: "place"; bricks: PlacedBrick[] }
  | { type: "erase"; x: number; y: number }
  | { type: "addRow" }
  | { type: "copyRow"; bricks: PlacedBrick[] }
  | { type: "clearRow" }
  | { type: "lockRow" }
  | { type: "unlockRow" }
  | { type: "cameraZoom"; delta: number }
  | { type: "cameraRotate"; delta: number }
  | { type: "cameraPan"; dx: number; dy: number }
  | { type: "cameraReset" };

const CAMERA_ZOOM_MIN = 0.65;
const CAMERA_ZOOM_MAX = 1.55;

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
    viewMode: "3d",
    camera: DEFAULT_CAMERA
  };
}

function isLocked(state: EditorState, row = state.currentRow): boolean {
  return state.lockedRows.includes(row);
}

function withRow(state: EditorState, bricks: PlacedBrick[]): EditorState {
  return { ...state, rows: { ...state.rows, [state.currentRow]: bricks } };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "setCurrentRow":
      return { ...state, currentRow: action.row };
    case "setTool":
      return { ...state, activeTool: action.tool };
    case "setOrientation":
      return { ...state, orientation: action.orientation };
    case "setViewMode":
      return { ...state, viewMode: action.mode };

    case "updateParameter": {
      const bounds = PARAM_BOUNDS[action.key];
      const value = clamp(Math.round(action.value), bounds.min, bounds.max);
      const parameters = { ...state.parameters, [action.key]: value };
      const grid = gridFromParameters(parameters);
      return { ...state, parameters, grid, rows: pruneRowsToGrid(state.rows, grid) };
    }

    case "reset":
      return initialEditorState();

    case "loadProject":
      return {
        ...state,
        parameters: action.project.parameters,
        grid: gridFromParameters(action.project.parameters),
        rows: cloneRows(action.project.rows),
        rowCount: action.project.rowCount,
        currentRow: 1,
        lockedRows: [...action.project.lockedRows],
        viewMode: "3d",
        activeTool: "standard",
        orientation: "h",
        camera: DEFAULT_CAMERA
      };

    case "loadDraft":
      return {
        ...state,
        parameters: action.draft.parameters,
        grid: gridFromParameters(action.draft.parameters),
        rowCount: action.draft.rowCount,
        currentRow: action.draft.currentRow,
        lockedRows: action.draft.lockedRows,
        rows: cloneRows(action.draft.rows)
      };

    case "place":
      if (isLocked(state)) return state;
      return withRow(state, placeBricksInRow(state.rows[state.currentRow] ?? [], action.bricks, state.grid));

    case "erase":
      if (isLocked(state)) return state;
      return withRow(state, removeBrickAt(state.rows[state.currentRow] ?? [], action.x, action.y));

    case "addRow": {
      const next = state.rowCount + 1;
      return { ...state, rowCount: next, currentRow: next };
    }

    case "copyRow":
      if (state.currentRow <= 1 || isLocked(state)) return state;
      return withRow(state, action.bricks);

    case "clearRow":
      if (isLocked(state)) return state;
      return withRow(state, []);

    case "lockRow":
      return {
        ...state,
        lockedRows: isLocked(state) ? state.lockedRows : [...state.lockedRows, state.currentRow],
        currentRow: Math.min(state.currentRow + 1, state.rowCount)
      };

    case "unlockRow":
      return { ...state, lockedRows: state.lockedRows.filter((row) => row !== state.currentRow) };

    case "cameraZoom":
      return { ...state, camera: { ...state.camera, zoom: clamp(Number((state.camera.zoom + action.delta).toFixed(2)), CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX) } };
    case "cameraRotate":
      return { ...state, camera: { ...state.camera, angle: (state.camera.angle + action.delta + 360) % 360 } };
    case "cameraPan":
      return { ...state, camera: { ...state.camera, offsetX: state.camera.offsetX + action.dx, offsetY: state.camera.offsetY + action.dy } };
    case "cameraReset":
      return { ...state, camera: DEFAULT_CAMERA };

    default:
      return state;
  }
}
