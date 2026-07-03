import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import type { Translate } from "../i18n";
import type { CameraState, CustomBrickSpec, MaterialsEstimate, NotchCorner, Orientation, Parameters, PlacedBrick, SnapStep, ToolKind, ViewMode, GridSpec } from "../domain/types";
import { isInsideGrid } from "../domain/geometry";
import { isNativeApp } from "../lib/platform";
import { useCustomBricks } from "../hooks/useCustomBricks";
import { BrickCutter } from "./BrickCutter";
import { Pill, SectionTitle } from "./ui";
import { PlanGrid } from "./PlanGrid";
import { SideSilhouette } from "./SideSilhouette";
import { MaterialsSummary } from "./MaterialsSummary";
import { ErrorBoundary } from "./ErrorBoundary";
import { PrintOrder } from "./PrintOrder";
import { Toolbox } from "./builder/Toolbox";
import { CameraControls } from "./builder/CameraControls";
import { MobileActionBar } from "./builder/MobileActionBar";

// Three.js + R3F is the heaviest dependency; load it only when the 3D view is shown.
// If the hashed chunk disappeared after a redeploy (stale tab), reload the page
// once to pick up fresh asset URLs instead of stranding the user on a fallback.
const RELOADED_FLAG = "brick-stove-chunk-reload";
const ThreeStack = lazy(() =>
  import("./three/ThreeStack")
    .then((m) => {
      sessionStorage.removeItem(RELOADED_FLAG);
      return { default: m.ThreeStack };
    })
    .catch((error) => {
      if (!sessionStorage.getItem(RELOADED_FLAG)) {
        sessionStorage.setItem(RELOADED_FLAG, "1");
        window.location.reload();
      }
      throw error;
    })
);

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
  snapStep: SnapStep;
  setSnapStep: (step: SnapStep) => void;
  customBrick: CustomBrickSpec | null;
  pickCustomBrick: (spec: CustomBrickSpec) => void;
  plateSpec: CustomBrickSpec;
  setPlateSize: (lengthMm: number, widthMm: number, thicknessMm: number, flush: boolean) => void;
  doorSpec: CustomBrickSpec;
  setDoorSize: (widthMm: number, heightMm: number) => void;
  userLogin: string;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  placeAt: (x: number, y: number, exactX?: number, exactY?: number) => void;
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
  camera: CameraState;
  cameraZoom: (delta: number) => void;
  cameraRotate: (delta: number) => void;
  cameraPan: (dx: number, dy: number) => void;
  cameraReset: () => void;
  saveCurrentProject: () => void;
};

export function BuilderScreen(props: BuilderScreenProps) {
  const {
    t, grid, rows, rowCount, currentRow, setCurrentRow, lockedRows, activeTool, setActiveTool,
    orientation, setOrientation, notchCorner, setNotchCorner, snapStep, setSnapStep,
    customBrick, pickCustomBrick, plateSpec, setPlateSize, doorSpec, setDoorSize, userLogin, viewMode, setViewMode, placeAt, addRow, deleteCurrentRow,
    copyPreviousRow, fillCurrentRow, clearCurrentRow, lockRow, unlockRow, canUndo, canRedo,
    undo, redo, parameters, materials, camera, cameraZoom, cameraRotate,
    cameraPan, cameraReset, saveCurrentProject
  } = props;
  const currentBricks = rows[currentRow] ?? [];
  const { customBricks, addCustomBrick, removeCustomBrick } = useCustomBricks(userLogin);
  const [cutterOpen, setCutterOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      // Не перехватываем undo, пока пользователь печатает (имя в резаке и т.п.)
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && event.shiftKey) {
        event.preventDefault();
        redo();
      } else if (key === "z") {
        event.preventDefault();
        undo();
      } else if (key === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);
  const visibleBricks = Object.values(rows).flat().filter((brick) => brick.row <= currentRow && isInsideGrid(brick, grid));
  const unit = t("unitCm");
  return (
    <main className="mt-4 space-y-3 xl:space-y-4">
      <SectionTitle title={t("editorTitle")} subtitle={t("editorSubtitle")} />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2 md:min-w-[340px]">
          <button onClick={saveCurrentProject} className="min-h-12 flex-1 rounded-[20px] border-2 border-[#3D2B1F]/10 bg-[#8FAF76] px-4 text-sm font-black text-[#3D2B1F]">{t("saveProject")}</button>
          {/* window.print() в Android WebView не работает — в приложении кнопку прячем */}
          {isNativeApp() ? null : <button onClick={() => window.print()} aria-label={t("printOrder")} className="min-h-12 rounded-[20px] border-2 border-[#3D2B1F]/10 bg-[#F5E6C8] px-4 text-sm font-black text-[#3D2B1F]">🖨 {t("printOrder")}</button>}
        </div>
        <div className="flex flex-wrap gap-2"><Pill>{t("currentRow")}: {currentRow}</Pill><Pill>{t("totalPlaced")}: {currentBricks.length}</Pill><Pill>{t("true3d")}</Pill><Pill>{grid.widthCm}×{grid.lengthCm} {unit}</Pill></div>
      </div>
      <PrintOrder t={t} grid={grid} rows={rows} rowCount={rowCount} lockedRows={lockedRows} parameters={parameters} materials={materials} />
      <div className="xl:grid xl:grid-cols-[320px_minmax(0,1fr)] xl:gap-4 xl:items-start">
        <aside className="space-y-3 xl:sticky xl:top-4">
          <MobileRowRail rowCount={rowCount} currentRow={currentRow} lockedRows={lockedRows} setCurrentRow={setCurrentRow} t={t} addRow={addRow} deleteCurrentRow={deleteCurrentRow} fillCurrentRow={fillCurrentRow} />
          <Toolbox
            t={t}
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            orientation={orientation}
            setOrientation={setOrientation}
            notchCorner={notchCorner}
            setNotchCorner={setNotchCorner}
            snapStep={snapStep}
            setSnapStep={setSnapStep}
            viewMode={viewMode}
            setViewMode={setViewMode}
            customBricks={customBricks}
            activeCustom={activeTool === "custom" ? customBrick : null}
            onPickCustom={pickCustomBrick}
            onRemoveCustom={removeCustomBrick}
            onOpenCutter={() => setCutterOpen(true)}
            plateSpec={plateSpec}
            setPlateSize={setPlateSize}
            doorSpec={doorSpec}
            setDoorSize={setDoorSize}
          />
          {cutterOpen && (
            <BrickCutter
              t={t}
              onClose={() => setCutterOpen(false)}
              onSave={(spec) => {
                addCustomBrick(spec);
                pickCustomBrick(spec);
              }}
            />
          )}
          {viewMode === "3d" && <CameraControls t={t} camera={camera} onZoom={cameraZoom} onRotate={cameraRotate} onPan={cameraPan} onReset={cameraReset} />}
          <MobileActionBar t={t} currentRow={currentRow} lockedRows={lockedRows} copyPreviousRow={copyPreviousRow} clearCurrentRow={clearCurrentRow} lockRow={lockRow} unlockRow={unlockRow} canUndo={canUndo} canRedo={canRedo} undo={undo} redo={redo} />
        </aside>
        <section className="space-y-3">
          <div className="rounded-[26px] border-2 border-[#3D2B1F]/10 bg-[#F5E6C8] p-2 shadow-md shadow-[#3D2B1F]/10 min-h-[620px] xl:min-h-[min(70dvh,900px)]">
            {viewMode === "2d"
              ? <PlanGrid grid={grid} bricks={currentBricks.filter((brick) => isInsideGrid(brick, grid))} activeTool={activeTool} orientation={orientation} notchCorner={notchCorner} snapStep={snapStep} customBrick={customBrick} plateSpec={plateSpec} doorSpec={doorSpec} placeAt={placeAt} t={t} />
              : (
                <ErrorBoundary fallback={<CanvasFallback>{t("aria3d")}</CanvasFallback>}>
                  <Suspense fallback={<CanvasFallback>{t("view3d")}…</CanvasFallback>}>
                    <ThreeStack grid={grid} bricks={visibleBricks} currentRow={currentRow} placeAt={placeAt} t={t} camera={camera} activeTool={activeTool} orientation={orientation} notchCorner={notchCorner} snapStep={snapStep} customBrick={customBrick} plateSpec={plateSpec} doorSpec={doorSpec} />
                  </Suspense>
                </ErrorBoundary>
              )}
          </div>
          <div className="rounded-[26px] border-2 border-[#3D2B1F]/10 bg-[#FFF7E8] p-3">
            <div className="mb-2 text-lg font-black">{t("liveSidePreview")}</div>
            <SideSilhouette parameters={parameters} lockedRows={lockedRows} t={t} />
            <MaterialsSummary materials={materials} t={t} />
          </div>
        </section>
      </div>
    </main>
  );
}

function CanvasFallback({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-[390px] place-items-center rounded-[22px] bg-[#FFF7E8] text-sm font-black text-[#3D2B1F]/55 md:h-[460px] xl:h-[min(62dvh,780px)]">
      {children}
    </div>
  );
}

function MobileRowRail({ rowCount, currentRow, lockedRows, setCurrentRow, t, addRow, deleteCurrentRow, fillCurrentRow }: { rowCount: number; currentRow: number; lockedRows: number[]; setCurrentRow: (row: number) => void; t: Translate; addRow: () => void; deleteCurrentRow: () => void; fillCurrentRow: () => void }) {
  const currentLocked = lockedRows.includes(currentRow);
  return (
    <section className="rounded-[24px] border-2 border-[#3D2B1F]/10 bg-[#F5E6C8] p-2">
      <div className="mb-2 flex items-center justify-between gap-1.5 px-1">
        <div className="text-xs font-black uppercase tracking-wide text-[#3D2B1F]/55">{t("rowsRail")}</div>
        <div className="flex gap-1.5">
          <button onClick={fillCurrentRow} disabled={currentLocked} className="min-h-9 rounded-2xl border-2 border-[#C1440E]/30 px-2.5 text-xs font-black text-[#C1440E] disabled:opacity-45">{t("fillRow")}</button>
          <button onClick={deleteCurrentRow} disabled={currentLocked || rowCount <= 1} aria-label={t("deleteRow")} className="min-h-9 rounded-2xl border-2 border-[#3D2B1F]/15 px-2.5 text-xs font-black text-[#3D2B1F]/70 disabled:opacity-45">{t("deleteRow")}</button>
          <button onClick={addRow} className="min-h-9 rounded-2xl bg-[#C1440E] px-2.5 text-xs font-black text-[#F5E6C8]">{t("addRow")}</button>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:flex-wrap md:overflow-visible">
        {Array.from({ length: rowCount }).map((_, index) => {
          const row = index + 1;
          const active = row === currentRow;
          const locked = lockedRows.includes(row);
          return (
            <button
              key={row}
              onClick={() => setCurrentRow(row)}
              aria-pressed={active}
              aria-label={`${t("currentRow")} ${row}${locked ? ` — ${t("rowCompleted")}` : ""}`}
              className={`grid shrink-0 min-h-12 min-w-12 place-items-center rounded-2xl border-2 text-sm font-black transition ${active ? "border-[#3D2B1F] bg-[#3D2B1F] text-[#F5E6C8]" : locked ? "border-[#5F7E4D]/30 bg-[#8FAF76] text-[#3D2B1F]" : "border-[#3D2B1F]/10 bg-[#FFF7E8] text-[#3D2B1F]"}`}
            >
              {locked ? "✓" : row}
            </button>
          );
        })}
      </div>
    </section>
  );
}
