import { editorReducer } from "./reducer";
import { initialEditorState } from "./state";
import type { EditorAction, EditorState } from "./types";

/**
 * Undo/redo wrapper around {@link editorReducer}. Only document mutations are
 * recorded; selections (row/tool/camera/view) change in place, and undo/redo
 * restores the document while keeping the current view state.
 */
export type HistoryState = {
  past: EditorState[];
  present: EditorState;
  future: EditorState[];
  /**
   * Ключ последнего записанного действия — для коалесинга: перетаскивание
   * слайдера параметра даёт десятки тиков, в истории они должны быть одним
   * шагом, иначе пара движений вымывает реальную кладку из undo.
   */
  lastTracked?: string;
};

export type HistoryAction = EditorAction | { type: "undo" } | { type: "redo" };

const HISTORY_LIMIT = 50;

const TRACKED_ACTIONS: ReadonlySet<EditorAction["type"]> = new Set([
  "place",
  "erase",
  "toggleDamper",
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
    rebateDepthMm: view.rebateDepthMm,
    snapStep: view.snapStep,
    customBrick: view.customBrick,
    plateSpec: view.plateSpec,
    doorSpec: view.doorSpec,
    damperSpec: view.damperSpec,
    grateSpec: view.grateSpec,
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
  const trackedKey = action.type === "updateParameter" ? `updateParameter:${action.key}` : action.type;
  if (action.type === "updateParameter" && state.lastTracked === trackedKey) {
    return { ...state, present, future: [] };
  }
  return {
    past: [...state.past, state.present].slice(-HISTORY_LIMIT),
    present,
    future: [],
    lastTracked: trackedKey
  };
}
