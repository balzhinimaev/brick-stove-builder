import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import type { Translate } from "../i18n";
import type { CameraState, CustomBrickSpec, GridSpec, MaterialsEstimate, NotchCorner, Orientation, Parameters, PlacedBrick, SnapStep, ToolKind, ViewMode } from "../domain/types";
import { TOOLS } from "../domain/constants";
import { isInsideGrid } from "../domain/geometry";
import { getToolColor, toolLabelKey } from "../domain/tools";
import { useCustomBricks } from "../hooks/useCustomBricks";
import { BrickCutter } from "./BrickCutter";
import { Pill, SectionTitle } from "./ui";
import { PlanGrid } from "./PlanGrid";
import { SideSilhouette } from "./SideSilhouette";
import { MaterialsSummary } from "./MaterialsSummary";
import { ErrorBoundary } from "./ErrorBoundary";
import { PrintOrder } from "./PrintOrder";

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
    customBrick, pickCustomBrick, userLogin, viewMode, setViewMode, placeAt, addRow, deleteCurrentRow,
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
          <button onClick={() => window.print()} aria-label={t("printOrder")} className="min-h-12 rounded-[20px] border-2 border-[#3D2B1F]/10 bg-[#F5E6C8] px-4 text-sm font-black text-[#3D2B1F]">🖨 {t("printOrder")}</button>
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
              ? <PlanGrid grid={grid} bricks={currentBricks.filter((brick) => isInsideGrid(brick, grid))} activeTool={activeTool} orientation={orientation} notchCorner={notchCorner} snapStep={snapStep} customBrick={customBrick} placeAt={placeAt} t={t} />
              : (
                <ErrorBoundary fallback={<CanvasFallback>{t("aria3d")}</CanvasFallback>}>
                  <Suspense fallback={<CanvasFallback>{t("view3d")}…</CanvasFallback>}>
                    <ThreeStack grid={grid} bricks={visibleBricks} currentRow={currentRow} placeAt={placeAt} t={t} camera={camera} activeTool={activeTool} orientation={orientation} notchCorner={notchCorner} snapStep={snapStep} customBrick={customBrick} />
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

function Toolbox({ t, activeTool, setActiveTool, orientation, setOrientation, notchCorner, setNotchCorner, snapStep, setSnapStep, viewMode, setViewMode, customBricks, activeCustom, onPickCustom, onRemoveCustom, onOpenCutter }: { t: Translate; activeTool: ToolKind; setActiveTool: (tool: ToolKind) => void; orientation: Orientation; setOrientation: (orientation: Orientation) => void; notchCorner: NotchCorner; setNotchCorner: (corner: NotchCorner) => void; snapStep: SnapStep; setSnapStep: (step: SnapStep) => void; viewMode: ViewMode; setViewMode: (mode: ViewMode) => void; customBricks: Array<{ id: string; spec: CustomBrickSpec }>; activeCustom: CustomBrickSpec | null; onPickCustom: (spec: CustomBrickSpec) => void; onRemoveCustom: (id: string) => void; onOpenCutter: () => void }) {
  return (
    <section className="space-y-2">
      <div className="rounded-[24px] border-2 border-[#3D2B1F]/10 bg-[#FFF7E8] p-2">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="text-xs font-black uppercase tracking-wide text-[#3D2B1F]/55">{t("tools")}</div>
          <button onClick={onOpenCutter} className="min-h-9 rounded-2xl border-2 border-[#C1440E]/40 px-3 text-xs font-black text-[#C1440E]">✂ {t("cutterOpen")}</button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:flex-wrap md:overflow-visible" role="group" aria-label={t("tools")}>
          {TOOLS.map((tool) => (
            <button
              key={tool}
              onClick={() => setActiveTool(tool)}
              aria-pressed={activeTool === tool}
              aria-label={t(toolLabelKey(tool))}
              className={`min-h-[58px] min-w-[78px] rounded-2xl border-2 px-2 text-[11px] font-black transition ${activeTool === tool ? "border-[#3D2B1F] bg-[#3D2B1F] text-[#F5E6C8]" : "border-[#3D2B1F]/10 bg-[#F5E6C8] text-[#3D2B1F]"}`}
            >
              <span className="mx-auto mb-1 block h-4 w-9 rounded-md border border-[#3D2B1F]/40" style={{ backgroundColor: getToolColor(tool) }} aria-hidden="true" />
              {t(toolLabelKey(tool))}
            </button>
          ))}
        </div>
        {customBricks.length > 0 && (
          <div className="mt-2 border-t border-[#3D2B1F]/10 pt-2">
            <div className="mb-1.5 px-1 text-[11px] font-black uppercase tracking-wide text-[#3D2B1F]/55">{t("cutterPalette")}</div>
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:flex-wrap md:overflow-visible">
              {customBricks.map((item) => {
                const active = activeTool === "custom" && activeCustom === item.spec;
                return (
                  <div key={item.id} className="relative shrink-0">
                    <button
                      onClick={() => onPickCustom(item.spec)}
                      aria-pressed={active}
                      className={`min-h-[58px] min-w-[86px] rounded-2xl border-2 px-2 pb-1 text-[10px] font-black transition ${active ? "border-[#3D2B1F] bg-[#3D2B1F] text-[#F5E6C8]" : "border-[#3D2B1F]/10 bg-[#F5E6C8] text-[#3D2B1F]"}`}
                    >
                      <CustomBrickPreview spec={item.spec} />
                      <span className="block max-w-[110px] truncate">{item.spec.name}</span>
                    </button>
                    <button
                      onClick={() => onRemoveCustom(item.id)}
                      aria-label={t("deleteProject")}
                      className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[#3D2B1F]/70 text-[10px] font-black text-[#F5E6C8]"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <p className="mt-1 px-1 text-xs font-bold leading-4 text-[#3D2B1F]/65">{t("paletteHint")}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Segmented title={t("orientation")} options={[{ key: "h", label: t("horizontal") }, { key: "v", label: t("vertical") }]} value={orientation} onChange={(value) => setOrientation(value as Orientation)} />
        <Segmented title={t("viewMode")} options={[{ key: "2d", label: t("view2d") }, { key: "3d", label: t("view3d") }]} value={viewMode} onChange={(value) => setViewMode(value as ViewMode)} />
        <Segmented title={t("snapTitle")} options={[{ key: "1", label: t("snapWhole") }, { key: "0.5", label: t("snapHalf") }]} value={String(snapStep)} onChange={(value) => setSnapStep(Number(value) as SnapStep)} />
      </div>
      {activeTool === "rebate" && (
        <Segmented
          title={t("notchCornerTitle")}
          options={[
            { key: "nw", label: "◰ " + t("notchNW") },
            { key: "ne", label: "◳ " + t("notchNE") },
            { key: "sw", label: "◱ " + t("notchSW") },
            { key: "se", label: "◲ " + t("notchSE") },
            { key: "n", label: "⬒ " + t("notchN") },
            { key: "e", label: "◨ " + t("notchE") },
            { key: "s", label: "⬓ " + t("notchS") },
            { key: "w", label: "◧ " + t("notchW") }
          ]}
          value={notchCorner}
          onChange={(value) => setNotchCorner(value as NotchCorner)}
        />
      )}
    </section>
  );
}

/** Мини-превью формы нарезанного кирпича для чипа палитры. */
function CustomBrickPreview({ spec }: { spec: CustomBrickSpec }) {
  const scale = 34 / 2; // 2 ячейки (полный кирпич) = 34px
  const W = spec.w * scale;
  const H = spec.h * scale;
  const n = spec.notch;
  const path = n
    ? (() => {
        const west = n.x1 <= 1e-6;
        const north = n.y1 <= 1e-6;
        const points: Array<[number, number]> = west
          ? north
            ? [[n.x2, 0], [spec.w, 0], [spec.w, spec.h], [0, spec.h], [0, n.y2], [n.x2, n.y2]]
            : [[0, 0], [spec.w, 0], [spec.w, spec.h], [n.x2, spec.h], [n.x2, n.y1], [0, n.y1]]
          : north
            ? [[0, 0], [n.x1, 0], [n.x1, n.y2], [spec.w, n.y2], [spec.w, spec.h], [0, spec.h]]
            : [[0, 0], [spec.w, 0], [spec.w, n.y1], [n.x1, n.y1], [n.x1, spec.h], [0, spec.h]];
        return `M${points.map(([x, y]) => `${x * scale} ${y * scale}`).join(" L")} Z`;
      })()
    : null;
  return (
    <svg className="mx-auto mb-1 block" width={38} height={22} viewBox={`${-1} ${-1} ${Math.max(W, 36) + 2} ${Math.max(H, 18) + 2}`}>
      {path
        ? <path d={path} fill={getToolColor("custom")} stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
        : <rect x={0} y={0} width={W} height={H} rx="2" fill={getToolColor("custom")} stroke="currentColor" strokeWidth="1" />}
    </svg>
  );
}

function Segmented({ title, options, value, onChange }: { title: string; options: Array<{ key: string; label: string }>; value: string; onChange: (value: string) => void }) {
  return (
    <div className="rounded-[22px] border border-[#3D2B1F]/10 bg-[#FFF7E8] p-2">
      <div className="mb-2 px-1 text-[11px] font-black uppercase tracking-wide text-[#3D2B1F]/55">{title}</div>
      <div className="grid grid-cols-2 gap-1.5" role="group" aria-label={title}>
        {options.map((option) => (
          <button
            key={option.key}
            onClick={() => onChange(option.key)}
            aria-pressed={value === option.key}
            className={`min-h-10 rounded-2xl px-2 text-[11px] font-black transition ${value === option.key ? "bg-[#3D2B1F] text-[#F5E6C8]" : "bg-[#F5E6C8] text-[#3D2B1F]"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CameraControls({
  t,
  camera,
  onZoom,
  onRotate,
  onPan,
  onReset
}: {
  t: Translate;
  camera: CameraState;
  onZoom: (delta: number) => void;
  onRotate: (delta: number) => void;
  onPan: (dx: number, dy: number) => void;
  onReset: () => void;
}) {
  return (
    <section className="rounded-[24px] border-2 border-[#3D2B1F]/10 bg-[#FFF7E8] p-2">
      <div className="mb-2 flex items-center justify-between gap-2"><div className="px-1 text-xs font-black uppercase tracking-wide text-[#3D2B1F]/55">{t("camera")}</div><div className="text-[11px] font-black text-[#5F7E4D]">{t("zoom")}: {Math.round(camera.zoom * 100)}% · {t("angle")}: {Math.round(camera.angle)}°</div></div>
      <div className="grid grid-cols-4 gap-2">
        <CameraButton onClick={() => onZoom(-0.08)} label={t("zoomOut")}>{t("zoomOut")}</CameraButton>
        <CameraButton onClick={() => onZoom(0.08)} label={t("zoomIn")}>{t("zoomIn")}</CameraButton>
        <CameraButton onClick={() => onRotate(-15)} label={t("rotateLeft")}>{t("rotateLeft")}</CameraButton>
        <CameraButton onClick={() => onRotate(15)} label={t("rotateRight")}>{t("rotateRight")}</CameraButton>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-2">
        <CameraButton onClick={() => onPan(-0.25, 0)} label="←">←</CameraButton>
        <CameraButton onClick={() => onPan(0, -0.25)} label="↑">↑</CameraButton>
        <CameraButton onClick={onReset} label={t("resetCamera")}>{t("resetCamera")}</CameraButton>
        <CameraButton onClick={() => onPan(0, 0.25)} label="↓">↓</CameraButton>
        <CameraButton onClick={() => onPan(0.25, 0)} label="→">→</CameraButton>
      </div>
      <p className="mt-2 px-1 text-[11px] font-bold leading-4 text-[#3D2B1F]/65">{t("dragHint")}</p>
    </section>
  );
}

function CameraButton({ children, onClick, label }: { children: ReactNode; onClick: () => void; label: string }) {
  return <button onClick={onClick} aria-label={label} className="min-h-11 rounded-[16px] border border-[#3D2B1F]/10 bg-[#F5E6C8] px-2 text-sm font-black text-[#3D2B1F]">{children}</button>;
}

function MobileActionBar({ t, currentRow, lockedRows, copyPreviousRow, clearCurrentRow, lockRow, unlockRow, canUndo, canRedo, undo, redo }: { t: Translate; currentRow: number; lockedRows: number[]; copyPreviousRow: () => void; clearCurrentRow: () => void; lockRow: () => void; unlockRow: () => void; canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void }) {
  const isLocked = lockedRows.includes(currentRow);
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#3D2B1F]/10 bg-[#FFF7E8]/95 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
      <div className="mx-auto grid max-w-[430px] grid-cols-[48px_48px_1fr_1fr_1fr] gap-2">
        <button onClick={undo} disabled={!canUndo} aria-label={t("undo")} title={`${t("undo")} (Ctrl+Z)`} className="min-h-12 rounded-[18px] border-2 border-[#3D2B1F]/10 bg-[#F5E6C8] text-lg font-black disabled:opacity-45">↶</button>
        <button onClick={redo} disabled={!canRedo} aria-label={t("redo")} title={`${t("redo")} (Ctrl+Shift+Z)`} className="min-h-12 rounded-[18px] border-2 border-[#3D2B1F]/10 bg-[#F5E6C8] text-lg font-black disabled:opacity-45">↷</button>
        <button onClick={copyPreviousRow} disabled={isLocked} className="min-h-12 rounded-[18px] border-2 border-[#3D2B1F]/10 bg-[#F5E6C8] px-2 text-xs font-black disabled:opacity-45">{t("copyPrev")}</button>
        <button onClick={clearCurrentRow} disabled={isLocked} className="min-h-12 rounded-[18px] border-2 border-[#3D2B1F]/10 bg-[#F5E6C8] px-2 text-xs font-black disabled:opacity-45">{t("clearRow")}</button>
        <button onClick={isLocked ? unlockRow : lockRow} className={`min-h-12 rounded-[18px] px-2 text-xs font-black text-[#F5E6C8] ${isLocked ? "bg-[#5F7E4D]" : "bg-[#C1440E]"}`}>{isLocked ? t("unlockRow") : t("completeRow")}</button>
      </div>
    </div>
  );
}
