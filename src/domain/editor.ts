import { DEFAULT_CAMERA, DEFAULT_PARAMETERS, INITIAL_ROWS } from "./constants";
import { cloneRows, gridFromParameters, placeBricksInRows, pruneRowsToGrid, removeBrickAt } from "./geometry";
import { PARAM_BOUNDS, clamp } from "./parameters";
import { makeDemoRows } from "./projects";
import type {
  CameraState,
  CustomBrickSpec,
  GridSpec,
  NotchCorner,
  Orientation,
  Parameters,
  PlacedBrick,
  ReadyProject,
  SnapStep,
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
  notchCorner: NotchCorner;
  snapStep: SnapStep;
  /** Выбранный в палитре кирпич из резака (активен при activeTool === "custom"). */
  customBrick: CustomBrickSpec | null;
  /** Размер варочной плиты (мм → ячейки), применяется при установке плиты. */
  plateSpec: CustomBrickSpec;
  /** Размер дверцы (ширина × высота, мм), применяется при установке дверцы. */
  doorSpec: CustomBrickSpec;
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
  | { type: "setNotchCorner"; corner: NotchCorner }
  | { type: "setSnapStep"; step: SnapStep }
  | { type: "pickCustomBrick"; spec: CustomBrickSpec }
  | { type: "setPlateSize"; lengthMm: number; widthMm: number; thicknessMm: number; flush: boolean }
  | { type: "setDoorSize"; widthMm: number; heightMm: number }
  | { type: "setViewMode"; mode: ViewMode }
  | { type: "updateParameter"; key: keyof Parameters; value: number }
  | { type: "reset" }
  | { type: "loadProject"; project: ReadyProject }
  | { type: "loadDraft"; draft: DraftSnapshot }
  | { type: "place"; bricks: PlacedBrick[] }
  | { type: "erase"; x: number; y: number }
  | { type: "addRow" }
  | { type: "deleteRow" }
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

/** 1 ячейка сетки = 125 мм. */
const MM_PER_CELL = 125;

export function plateSpecFromMm(lengthMm: number, widthMm: number, thicknessMm = 14, flush = false): CustomBrickSpec {
  return {
    name: `Плита ${lengthMm}×${widthMm}×${thicknessMm}`,
    w: lengthMm / MM_PER_CELL,
    h: widthMm / MM_PER_CELL,
    notch: null,
    thicknessMm,
    flush
  };
}

/** Двухконфорочная 710×410 — самый ходовой типоразмер. */
export const DEFAULT_PLATE = plateSpecFromMm(710, 410);

export function doorSpecFromMm(widthMm: number, heightMm: number): CustomBrickSpec {
  return {
    name: `Дверца ${widthMm}×${heightMm}`,
    w: widthMm / MM_PER_CELL,
    // глубина рамки в плане — полкирпича (одна ячейка)
    h: 1,
    notch: null,
    heightMm
  };
}

/** Топочная ДТ-3 250×210 — базовый типоразмер. */
export const DEFAULT_DOOR = doorSpecFromMm(250, 210);

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
    snapStep: 1,
    customBrick: null,
    plateSpec: DEFAULT_PLATE,
    doorSpec: DEFAULT_DOOR,
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
    case "setNotchCorner":
      return { ...state, notchCorner: action.corner };
    case "setSnapStep":
      return { ...state, snapStep: action.step };
    case "pickCustomBrick":
      return { ...state, activeTool: "custom", customBrick: action.spec };
    case "setPlateSize":
      return { ...state, plateSpec: plateSpecFromMm(action.lengthMm, action.widthMm, action.thicknessMm, action.flush) };
    case "setDoorSize":
      return { ...state, doorSpec: doorSpecFromMm(action.widthMm, action.heightMm) };
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

    case "place": {
      if (isLocked(state)) return state;
      // честная 3D-проверка: конфликты считаются по плану И высоте, между рядами
      const rows = placeBricksInRows(state.rows, state.currentRow, action.bricks, state.grid);
      return rows ? { ...state, rows } : state;
    }

    case "erase":
      if (isLocked(state)) return state;
      return withRow(state, removeBrickAt(state.rows[state.currentRow] ?? [], action.x, action.y));

    case "addRow": {
      const next = state.rowCount + 1;
      return { ...state, rowCount: next, currentRow: next };
    }

    case "deleteRow": {
      if (state.rowCount <= 1 || isLocked(state)) return state;
      const deleted = state.currentRow;
      const rows: Record<number, PlacedBrick[]> = {};
      for (const [key, bricks] of Object.entries(state.rows)) {
        const row = Number(key);
        if (row === deleted) continue;
        const target = row > deleted ? row - 1 : row;
        rows[target] = row > deleted ? bricks.map((brick) => ({ ...brick, row: target })) : bricks;
      }
      const rowCount = state.rowCount - 1;
      return {
        ...state,
        rows,
        rowCount,
        currentRow: Math.min(deleted, rowCount),
        lockedRows: state.lockedRows
          .filter((row) => row !== deleted)
          .map((row) => (row > deleted ? row - 1 : row))
      };
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

/**
 * Undo/redo wrapper around {@link editorReducer}. Only document mutations are
 * recorded; selections (row/tool/camera/view) change in place, and undo/redo
 * restores the document while keeping the current view state.
 */
export type HistoryState = {
  past: EditorState[];
  present: EditorState;
  future: EditorState[];
};

export type HistoryAction = EditorAction | { type: "undo" } | { type: "redo" };

const HISTORY_LIMIT = 50;

const TRACKED_ACTIONS: ReadonlySet<EditorAction["type"]> = new Set([
  "place",
  "erase",
  "addRow",
  "deleteRow",
  "copyRow",
  "clearRow",
  "lockRow",
  "unlockRow",
  "updateParameter"
]);

/** Loading a different document makes the old timeline meaningless. */
const HISTORY_RESET_ACTIONS: ReadonlySet<EditorAction["type"]> = new Set(["reset", "loadProject", "loadDraft"]);

export function initialHistoryState(): HistoryState {
  return { past: [], present: initialEditorState(), future: [] };
}

/** Restore a document snapshot but keep the user's current view/selections. */
function restoreDocument(snapshot: EditorState, view: EditorState): EditorState {
  return {
    ...snapshot,
    activeTool: view.activeTool,
    orientation: view.orientation,
    notchCorner: view.notchCorner,
    snapStep: view.snapStep,
    customBrick: view.customBrick,
    plateSpec: view.plateSpec,
    doorSpec: view.doorSpec,
    viewMode: view.viewMode,
    camera: view.camera
  };
}

export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  if (action.type === "undo") {
    if (!state.past.length) return state;
    const previous = state.past[state.past.length - 1];
    return {
      past: state.past.slice(0, -1),
      present: restoreDocument(previous, state.present),
      future: [state.present, ...state.future]
    };
  }

  if (action.type === "redo") {
    if (!state.future.length) return state;
    const [next, ...future] = state.future;
    return {
      past: [...state.past, state.present],
      present: restoreDocument(next, state.present),
      future
    };
  }

  const present = editorReducer(state.present, action);
  if (present === state.present) return state;
  if (HISTORY_RESET_ACTIONS.has(action.type)) return { past: [], present, future: [] };
  if (!TRACKED_ACTIONS.has(action.type)) return { ...state, present };
  return {
    past: [...state.past, state.present].slice(-HISTORY_LIMIT),
    present,
    future: []
  };
}
