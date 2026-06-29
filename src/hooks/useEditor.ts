import { useCallback, useMemo, useReducer } from "react";
import { editorReducer, initialEditorState, type DraftSnapshot } from "../domain/editor";
import { grateAssemblyBricks } from "../domain/geometry";
import { estimateMaterials } from "../domain/materials";
import { nextSeq } from "../lib/id";
import type { Orientation, Parameters, PlacedBrick, ReadyProject, ToolKind, ViewMode } from "../domain/types";

/**
 * React binding around the pure {@link editorReducer}. The only impurity it
 * adds is brick id allocation; all state transitions stay in the reducer.
 */
export function useEditor() {
  const [state, dispatch] = useReducer(editorReducer, undefined, initialEditorState);

  const allBricks = useMemo(() => Object.values(state.rows).flat(), [state.rows]);
  const materials = useMemo(() => estimateMaterials(allBricks, state.parameters), [allBricks, state.parameters]);

  const placeAt = useCallback(
    (x: number, y: number) => {
      if (state.activeTool === "eraser") {
        dispatch({ type: "erase", x, y });
        return;
      }
      if (state.activeTool === "grate") {
        dispatch({ type: "place", bricks: grateAssemblyBricks(state.currentRow, x, y, state.orientation, nextSeq) });
        return;
      }
      const brick: PlacedBrick = { id: `r${state.currentRow}-${nextSeq()}-${x}-${y}`, row: state.currentRow, x, y, kind: state.activeTool, orientation: state.orientation };
      dispatch({ type: "place", bricks: [brick] });
    },
    [state.activeTool, state.orientation, state.currentRow]
  );

  const copyPreviousRow = useCallback(() => {
    if (state.currentRow <= 1 || state.lockedRows.includes(state.currentRow)) return;
    const previous = state.rows[state.currentRow - 1] ?? [];
    const bricks = previous.map((brick, index) => ({ ...brick, id: `r${state.currentRow}-copy-${index}-${nextSeq()}`, row: state.currentRow }));
    dispatch({ type: "copyRow", bricks });
  }, [state.currentRow, state.lockedRows, state.rows]);

  return {
    parameters: state.parameters,
    grid: state.grid,
    rowCount: state.rowCount,
    currentRow: state.currentRow,
    lockedRows: state.lockedRows,
    rows: state.rows,
    activeTool: state.activeTool,
    orientation: state.orientation,
    viewMode: state.viewMode,
    camera: state.camera,
    allBricks,
    materials,

    setCurrentRow: useCallback((row: number) => dispatch({ type: "setCurrentRow", row }), []),
    setActiveTool: useCallback((tool: ToolKind) => dispatch({ type: "setTool", tool }), []),
    setOrientation: useCallback((orientation: Orientation) => dispatch({ type: "setOrientation", orientation }), []),
    setViewMode: useCallback((mode: ViewMode) => dispatch({ type: "setViewMode", mode }), []),
    updateParameter: useCallback((key: keyof Parameters, value: number) => dispatch({ type: "updateParameter", key, value }), []),

    placeAt,
    addRow: useCallback(() => dispatch({ type: "addRow" }), []),
    copyPreviousRow,
    clearCurrentRow: useCallback(() => dispatch({ type: "clearRow" }), []),
    lockRow: useCallback(() => dispatch({ type: "lockRow" }), []),
    unlockRow: useCallback(() => dispatch({ type: "unlockRow" }), []),

    reset: useCallback(() => dispatch({ type: "reset" }), []),
    loadProject: useCallback((project: ReadyProject) => dispatch({ type: "loadProject", project }), []),
    loadDraft: useCallback((draft: DraftSnapshot) => dispatch({ type: "loadDraft", draft }), []),

    cameraZoom: useCallback((delta: number) => dispatch({ type: "cameraZoom", delta }), []),
    cameraRotate: useCallback((delta: number) => dispatch({ type: "cameraRotate", delta }), []),
    cameraPan: useCallback((dx: number, dy: number) => dispatch({ type: "cameraPan", dx, dy }), []),
    cameraReset: useCallback(() => dispatch({ type: "cameraReset" }), [])
  };
}

export type EditorApi = ReturnType<typeof useEditor>;
