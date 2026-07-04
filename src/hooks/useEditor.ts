import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { buildPlacementDrafts, historyReducer, initialHistoryState, type DraftSnapshot, type PlacementSelection } from "../domain/editor";
import { brickBounds, fillRowBricks, planPlacement } from "../domain/geometry";
import { estimateMaterials } from "../domain/materials";
import { nextSeq } from "../lib/id";
import type { CustomBrickSpec, NotchCorner, Orientation, Parameters, PlacedBrick, ReadyProject, SnapStep, ToolKind, ViewMode } from "../domain/types";

/** Сколько держится красная подсветка элементов, помешавших размещению. */
const REJECT_FLASH_MS = 900;

/**
 * React binding around the pure {@link historyReducer}. The only impurity it
 * adds is brick id allocation; all state transitions stay in the reducer.
 */
export function useEditor() {
  const [history, dispatch] = useReducer(historyReducer, undefined, initialHistoryState);
  const state = history.present;

  const allBricks = useMemo(() => Object.values(state.rows).flat(), [state.rows]);
  const materials = useMemo(() => estimateMaterials(allBricks, state.parameters), [allBricks, state.parameters]);

  const selection: PlacementSelection = useMemo(
    () => ({
      currentRow: state.currentRow,
      activeTool: state.activeTool,
      orientation: state.orientation,
      notchCorner: state.notchCorner,
      rebateDepthMm: state.rebateDepthMm,
      customBrick: state.customBrick,
      plateSpec: state.plateSpec,
      doorSpec: state.doorSpec,
      damperSpec: state.damperSpec,
      grateSpec: state.grateSpec
    }),
    [state.currentRow, state.activeTool, state.orientation, state.notchCorner, state.rebateDepthMm, state.customBrick, state.plateSpec, state.doorSpec, state.damperSpec, state.grateSpec]
  );

  /**
   * Обратная связь об отказе размещения: id элементов, которые помешали, —
   * сцена коротко подсвечивает их красным вместо молчаливого «ничего не произошло».
   */
  const [rejectedIds, setRejectedIds] = useState<ReadonlySet<string>>(() => new Set());
  const rejectTimer = useRef<number | null>(null);
  useEffect(() => () => { if (rejectTimer.current !== null) window.clearTimeout(rejectTimer.current); }, []);
  const flashRejection = useCallback((bricks: PlacedBrick[]) => {
    if (!bricks.length) return;
    setRejectedIds(new Set(bricks.map((brick) => brick.id)));
    if (rejectTimer.current !== null) window.clearTimeout(rejectTimer.current);
    rejectTimer.current = window.setTimeout(() => {
      rejectTimer.current = null;
      setRejectedIds(new Set());
    }, REJECT_FLASH_MS);
  }, []);

  const placeAt = useCallback(
    (x: number, y: number, exactX?: number, exactY?: number) => {
      if (state.activeTool === "eraser") {
        // Ластик бьёт по фактической точке клика, а не по снапнутому узлу:
        // иначе обрезки в «дальней» части ячейки недостижимы при шаге 1.
        dispatch({ type: "erase", x: exactX ?? x, y: exactY ?? y });
        return;
      }
      if (state.lockedRows.includes(state.currentRow)) return;
      // Инструмент «Задвижка» по уже стоящей задвижке — переключить открыта/закрыта,
      // а не пытаться поставить вторую поверх.
      if (state.activeTool === "damper") {
        const px = exactX ?? x;
        const py = exactY ?? y;
        const hit = (state.rows[state.currentRow] ?? []).find((brick) => {
          if (brick.kind !== "damper") return false;
          const b = brickBounds(brick);
          return px >= b.x1 && px < b.x2 && py >= b.y1 && py < b.y2;
        });
        if (hit) {
          dispatch({ type: "toggleDamper", id: hit.id });
          return;
        }
      }
      const drafts = buildPlacementDrafts(selection, x, y, nextSeq);
      if (!drafts) return;
      const plan = planPlacement(state.rows, state.currentRow, drafts, state.grid);
      if (plan.rows) dispatch({ type: "place", bricks: drafts });
      else flashRejection(plan.conflicts);
    },
    [state.activeTool, state.lockedRows, state.currentRow, state.rows, state.grid, selection, flashRejection]
  );

  /** Ляжет ли текущий инструмент в (x, y) — для честного превью наведения. */
  const canPlaceAt = useCallback(
    (x: number, y: number): boolean => {
      if (state.activeTool === "eraser") return true;
      if (state.lockedRows.includes(state.currentRow)) return false;
      const drafts = buildPlacementDrafts(selection, x, y, () => 0);
      if (!drafts) return false;
      return planPlacement(state.rows, state.currentRow, drafts, state.grid).rows !== null;
    },
    [state.activeTool, state.lockedRows, state.currentRow, state.rows, state.grid, selection]
  );

  const copyPreviousRow = useCallback(() => {
    if (state.currentRow <= 1 || state.lockedRows.includes(state.currentRow)) return;
    const previous = state.rows[state.currentRow - 1] ?? [];
    const bricks = previous.map((brick, index) => ({ ...brick, id: `r${state.currentRow}-copy-${index}-${nextSeq()}`, row: state.currentRow }));
    dispatch({ type: "copyRow", bricks });
  }, [state.currentRow, state.lockedRows, state.rows]);

  const fillCurrentRow = useCallback(() => {
    if (state.lockedRows.includes(state.currentRow)) return;
    // Заполнение видит ВСЮ кладку: дверца из нижнего ряда или утопленная плита
    // держат свой объём, а накладную плиту overlaps3D сам не считает
    // конфликтом — под ней кладка продолжается.
    const existing = Object.values(state.rows).flat();
    const bricks = fillRowBricks(existing, state.grid, state.currentRow, state.orientation, nextSeq);
    if (bricks.length) dispatch({ type: "place", bricks });
  }, [state.currentRow, state.lockedRows, state.rows, state.grid, state.orientation]);

  return {
    parameters: state.parameters,
    grid: state.grid,
    rowCount: state.rowCount,
    currentRow: state.currentRow,
    lockedRows: state.lockedRows,
    rows: state.rows,
    activeTool: state.activeTool,
    orientation: state.orientation,
    notchCorner: state.notchCorner,
    rebateDepthMm: state.rebateDepthMm,
    snapStep: state.snapStep,
    customBrick: state.customBrick,
    plateSpec: state.plateSpec,
    doorSpec: state.doorSpec,
    damperSpec: state.damperSpec,
    grateSpec: state.grateSpec,
    viewMode: state.viewMode,
    camera: state.camera,
    allBricks,
    materials,

    setCurrentRow: useCallback((row: number) => dispatch({ type: "setCurrentRow", row }), []),
    setActiveTool: useCallback((tool: ToolKind) => dispatch({ type: "setTool", tool }), []),
    setOrientation: useCallback((orientation: Orientation) => dispatch({ type: "setOrientation", orientation }), []),
    setNotchCorner: useCallback((corner: NotchCorner) => dispatch({ type: "setNotchCorner", corner }), []),
    setRebateDepth: useCallback((depthMm: number) => dispatch({ type: "setRebateDepth", depthMm }), []),
    setSnapStep: useCallback((step: SnapStep) => dispatch({ type: "setSnapStep", step }), []),
    pickCustomBrick: useCallback((spec: CustomBrickSpec) => dispatch({ type: "pickCustomBrick", spec }), []),
    setPlateSize: useCallback((lengthMm: number, widthMm: number, thicknessMm: number, flush: boolean) => dispatch({ type: "setPlateSize", lengthMm, widthMm, thicknessMm, flush }), []),
    setDoorSize: useCallback((widthMm: number, heightMm: number) => dispatch({ type: "setDoorSize", widthMm, heightMm }), []),
    setDamperSize: useCallback((lengthMm: number, widthMm: number) => dispatch({ type: "setDamperSize", lengthMm, widthMm }), []),
    setGrateSize: useCallback((lengthMm: number, widthMm: number, thicknessMm: number) => dispatch({ type: "setGrateSize", lengthMm, widthMm, thicknessMm }), []),
    toggleDamper: useCallback((id: string) => dispatch({ type: "toggleDamper", id }), []),
    setViewMode: useCallback((mode: ViewMode) => dispatch({ type: "setViewMode", mode }), []),
    updateParameter: useCallback((key: keyof Parameters, value: number) => dispatch({ type: "updateParameter", key, value }), []),

    placeAt,
    canPlaceAt,
    rejectedIds,
    addRow: useCallback(() => dispatch({ type: "addRow" }), []),
    deleteCurrentRow: useCallback(() => dispatch({ type: "deleteRow" }), []),
    copyPreviousRow,
    fillCurrentRow,
    clearCurrentRow: useCallback(() => dispatch({ type: "clearRow" }), []),
    lockRow: useCallback(() => dispatch({ type: "lockRow" }), []),
    unlockRow: useCallback(() => dispatch({ type: "unlockRow" }), []),

    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    undo: useCallback(() => dispatch({ type: "undo" }), []),
    redo: useCallback(() => dispatch({ type: "redo" }), []),

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
