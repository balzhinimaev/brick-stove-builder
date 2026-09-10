import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import type { Translate } from "../i18n";
import type {
  CustomBrickSpec,
  MaterialsEstimate,
  NotchCorner,
  Orientation,
  Parameters,
  PlacedBrick,
  SnapStep,
  ToolKind,
  GridSpec
} from "../domain/types";
import type { PlacementPoint, PlacementPreview } from "../domain/editor/preview";
import { isInsideGrid } from "../domain/geometry";
import { isNativeApp } from "../lib/platform";
import { useCustomBricks } from "../hooks/useCustomBricks";
import { BrickCutter } from "./BrickCutter";
import { MaterialsSummary } from "./MaterialsSummary";
import { ErrorBoundary } from "./ErrorBoundary";
import { PrintOrder } from "./PrintOrder";
import { Toolbox } from "./builder/Toolbox";

const ThreeStack = lazy(() => import("./three/ThreeStack").then((module) => ({ default: module.ThreeStack })));

export type BuilderScreenProps = {
  t: Translate;
  grid: GridSpec;
  rows: Record<number, PlacedBrick[]>;
  rowCount: number;
  currentRow: number;
  setCurrentRow: (row: number) => void;
  lockedRows: number[];
  activeTool: ToolKind;
  setActiveTool: (tool: ToolKind) => void;
  orientation: Orientation;
  setOrientation: (orientation: Orientation) => void;
  notchCorner: NotchCorner;
  setNotchCorner: (corner: NotchCorner) => void;
  rebateDepthMm: number;
  setRebateDepth: (depthMm: number) => void;
  snapStep: SnapStep;
  setSnapStep: (step: SnapStep) => void;
  customBrick: CustomBrickSpec | null;
  pickCustomBrick: (spec: CustomBrickSpec) => void;
  plateSpec: CustomBrickSpec;
  setPlateSize: (lengthMm: number, widthMm: number, thicknessMm: number, flush: boolean) => void;
  doorSpec: CustomBrickSpec;
  setDoorSize: (widthMm: number, heightMm: number) => void;
  damperSpec: CustomBrickSpec;
  setDamperSize: (lengthMm: number, widthMm: number) => void;
  grateSpec: CustomBrickSpec;
  setGrateSize: (lengthMm: number, widthMm: number, thicknessMm: number) => void;
  userLogin: string;
  placeAt: (x: number, y: number, exactX?: number, exactY?: number) => void;
  previewAt: (point: PlacementPoint) => PlacementPreview;
  addRow: () => void;
  deleteCurrentRow: () => void;
  copyPreviousRow: () => void;
  fillCurrentRow: () => void;
  clearCurrentRow: () => void;
  lockRow: () => void;
  unlockRow: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  parameters: Parameters;
  materials: MaterialsEstimate;
  saveCurrentProject: () => void;
};

export function BuilderScreen(props: BuilderScreenProps) {
  const {
    t,
    rows,
    grid,
    currentRow,
    rowCount,
    lockedRows,
    setCurrentRow,
    activeTool,
    setActiveTool,
    orientation,
    setOrientation,
    undo,
    redo
  } = props;
  const { customBricks, addCustomBrick, removeCustomBrick } = useCustomBricks(props.userLogin);
  const [cutterOpen, setCutterOpen] = useState(false);
  const [panel, setPanel] = useState<"tools" | "rows" | "materials">("tools");
  const locked = lockedRows.includes(currentRow);
  const visibleDocument = useMemo(
    () =>
      Object.values(rows)
        .flat()
        .filter((brick) => isInsideGrid(brick, grid)),
    [rows, grid]
  );
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (cutterOpen) return;
      if (target?.isContentEditable || target?.closest("input,textarea,select,dialog,[role=dialog]")) return;
      const key = event.key.toLowerCase();
      if (event.ctrlKey || event.metaKey) {
        if (key === "z") {
          event.preventDefault();
          if (event.shiftKey) redo();
          else undo();
        }
        if (key === "y") {
          event.preventDefault();
          redo();
        }
      } else if (!event.altKey) {
        if (key === "r") {
          event.preventDefault();
          setOrientation(orientation === "h" ? "v" : "h");
        }
        if (key === "b") setActiveTool("standard");
        if (key === "e") setActiveTool("eraser");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, orientation, setOrientation, setActiveTool, cutterOpen]);
  return (
    <main className="studio-editor">
      <div className="studio-commandbar">
        <div className="studio-row-switch">
          <button
            type="button"
            disabled={currentRow <= 1}
            aria-label={t("previousRow")}
            onClick={() => setCurrentRow(currentRow - 1)}
          >
            ‹
          </button>
          <label>
            {t("currentRow")}{" "}
            <select
              value={currentRow}
              onChange={(event) => setCurrentRow(Number(event.target.value))}
              aria-label={t("currentRow")}
            >
              {Array.from({ length: rowCount }, (_, i) => i + 1).map((row) => (
                <option key={row} value={row}>
                  {row}
                  {lockedRows.includes(row) ? " ✓" : ""}
                </option>
              ))}
            </select>
            <span className="studio-muted"> / {rowCount}</span>
          </label>
          <button
            type="button"
            disabled={currentRow >= rowCount}
            aria-label={t("nextRow")}
            onClick={() => setCurrentRow(currentRow + 1)}
          >
            ›
          </button>
          <button type="button" onClick={props.addRow}>
            {t("addRow")}
          </button>
        </div>
        <div className="studio-history">
          <button
            type="button"
            onClick={undo}
            disabled={!props.canUndo}
            aria-label={t("undo")}
            title={`${t("undo")} · Ctrl+Z`}
          >
            ↶
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!props.canRedo}
            aria-label={t("redo")}
            title={`${t("redo")} · Ctrl+Shift+Z`}
          >
            ↷
          </button>
          <button type="button" className="studio-primary" onClick={props.saveCurrentProject}>
            {t("saveProject")}
          </button>
        </div>
      </div>
      <div className="studio-layout">
        <section className="studio-viewport" aria-label={t("editorTitle")}>
          <ErrorBoundary
            fallback={
              <div className="studio-fallback">
                <p>{t("sceneError")}</p>
                <button type="button" onClick={() => window.location.reload()}>
                  {t("reloadScene")}
                </button>
              </div>
            }
          >
            <Suspense fallback={<div className="studio-fallback">{t("loadingScene")}</div>}>
              <ThreeStack
                foundationHeight={(props.parameters.foundationThickness * 10) / 125}
                grid={grid}
                bricks={visibleDocument}
                currentRow={currentRow}
                locked={locked}
                t={t}
                snapStep={props.snapStep}
                previewAt={props.previewAt}
                placeAt={props.placeAt}
                rotateBrick={() => setOrientation(orientation === "h" ? "v" : "h")}
              />
            </Suspense>
          </ErrorBoundary>
        </section>
        <aside className="studio-inspector">
          <fieldset className="studio-panel-tabs" aria-label={t("editorPanels")}>
            {(
              [
                ["tools", "tools"],
                ["rows", "rowsRail"],
                ["materials", "materialsSnapshot"]
              ] as const
            ).map(([key, label]) => (
              <button key={key} type="button" aria-pressed={panel === key} onClick={() => setPanel(key)}>
                {t(label)}
              </button>
            ))}
          </fieldset>
          <div className="studio-panel-content">
            {panel === "tools" && (
              <Toolbox
                t={t}
                activeTool={activeTool}
                setActiveTool={setActiveTool}
                orientation={orientation}
                setOrientation={setOrientation}
                notchCorner={props.notchCorner}
                setNotchCorner={props.setNotchCorner}
                rebateDepthMm={props.rebateDepthMm}
                setRebateDepth={props.setRebateDepth}
                plateThicknessMm={props.plateSpec.thicknessMm ?? 14}
                snapStep={props.snapStep}
                setSnapStep={props.setSnapStep}
                customBricks={customBricks}
                activeCustom={activeTool === "custom" ? props.customBrick : null}
                onPickCustom={props.pickCustomBrick}
                onRemoveCustom={removeCustomBrick}
                onOpenCutter={() => setCutterOpen(true)}
                plateSpec={props.plateSpec}
                setPlateSize={props.setPlateSize}
                doorSpec={props.doorSpec}
                setDoorSize={props.setDoorSize}
                damperSpec={props.damperSpec}
                setDamperSize={props.setDamperSize}
                grateSpec={props.grateSpec}
                setGrateSize={props.setGrateSize}
              />
            )}
            {panel === "rows" && (
              <div className="studio-rows">
                <p className="studio-muted">{t("rowVisibilityHint")}</p>
                <div className="studio-row-list">
                  {Array.from({ length: rowCount }, (_, i) => i + 1).map((row) => (
                    <button
                      key={row}
                      type="button"
                      aria-pressed={row === currentRow}
                      onClick={() => setCurrentRow(row)}
                    >
                      <span>
                        {t("currentRow")} {row} {lockedRows.includes(row) ? "✓" : ""}
                      </span>
                      <span className="studio-muted">{(rows[row] ?? []).length}</span>
                    </button>
                  ))}
                </div>
                <div className="studio-row-actions">
                  <button type="button" disabled={locked || currentRow === 1} onClick={props.copyPreviousRow}>
                    {t("copyPrev")}
                  </button>
                  <button type="button" disabled={locked} onClick={props.fillCurrentRow}>
                    {t("fillRow")}
                  </button>
                  <button type="button" disabled={locked} onClick={props.clearCurrentRow}>
                    {t("clearRow")}
                  </button>
                  <button type="button" disabled={locked || rowCount === 1} onClick={props.deleteCurrentRow}>
                    {t("deleteRow")}
                  </button>
                </div>
              </div>
            )}
            {panel === "materials" && (
              <>
                <MaterialsSummary materials={props.materials} t={t} />
                {!isNativeApp() && (
                  <button type="button" onClick={() => window.print()}>
                    {t("printOrder")}
                  </button>
                )}
                <p className="studio-muted">{t("modelScaleHint")}</p>
              </>
            )}
          </div>
          <button type="button" className="studio-lock" onClick={locked ? props.unlockRow : props.lockRow}>
            {locked ? t("unlockRow") : t("completeRow")} · {t("currentRow")} {currentRow}
          </button>
        </aside>
      </div>
      {cutterOpen && (
        <BrickCutter
          t={t}
          onClose={() => setCutterOpen(false)}
          onSave={(spec) => {
            addCustomBrick(spec);
            props.pickCustomBrick(spec);
          }}
        />
      )}
      <PrintOrder
        t={t}
        grid={grid}
        rows={rows}
        rowCount={rowCount}
        lockedRows={lockedRows}
        parameters={props.parameters}
        materials={props.materials}
      />
    </main>
  );
}
