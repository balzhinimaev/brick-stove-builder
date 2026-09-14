import { PartInspector } from "./PartInspector";
import { ExactSection } from "./ExactSection";
import { partNumbers } from "../domain/masonrySections";
import { ProjectBar } from "./ProjectBar";
import type { LocalWorkspace } from "../hooks/useLocalWorkspace";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { PlacementPoint, PlacementPreview } from "../domain/editor/preview";
import { isInsideGrid } from "../domain/geometry";
import type {
  CustomBrickSpec,
  GridSpec,
  MaterialsEstimate,
  NotchCorner,
  Orientation,
  Parameters,
  PlacedBrick,
  SnapStep,
  ToolKind
} from "../domain/types";
import { useCustomBricks } from "../hooks/useCustomBricks";
import type { Translate } from "../i18n";
import { isNativeApp } from "../lib/platform";
import { BrickCutter } from "./BrickCutter";
import { Toolbox } from "./builder/Toolbox";
import type { TeplushkaInspection } from "./builder/teplushkaInspection";
import { ErrorBoundary } from "./ErrorBoundary";
import { HouseRussianGuide } from "./HouseRussianGuide";
import { MasonryReviewPanel } from "./MasonryReviewPanel";
import { MaterialsSummary } from "./MaterialsSummary";
import { PrintOrder } from "./PrintOrder";
import { PhysicsReview } from "./PhysicsReview";

const ThreeStack = lazy(() => import("./three/ThreeStack").then((module) => ({ default: module.ThreeStack })));

export type BuilderScreenProps = {
  workspace?: LocalWorkspace;
  onServerSave?: () => void;
  editPart?: (id: string, brick: PlacedBrick, duplicate?: boolean) => string | null;
  removePart?: (id: string) => void;
  sceneRevision?: number;
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
  inspection?: TeplushkaInspection;
  onExitSection?: () => void;
  setDamperOpenings: (openings: Record<string, number>) => void;
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
  const isHouse = useMemo(() => Object.values(rows).some((r) => r.some((b) => b.id.startsWith("rp54-"))), [rows]);
  const [masonrySelection, setMasonrySelection] = useState<{ revision?: number; row: number; ids: string[] } | null>(
    null
  );
  const masonryIds = masonrySelection && masonrySelection.revision === props.sceneRevision ? masonrySelection.ids : [];
  const [houseContext, setHouseContext] = useState(false);
  const [houseInspection, setHouseInspection] = useState<TeplushkaInspection>({
    section: "whole",
    fraction: 0.4,
    courseOnly: true
  });
  const houseControls = {
    currentRow,
    house: houseContext,
    inspection: houseInspection,
    onHouse: (value: boolean) => {
      setHouseContext(value);
      setCurrentRow(value ? rowCount : Math.min(29, rowCount));
      setHouseInspection({ section: "whole", fraction: 0.4, courseOnly: true });
    },
    onCourse: (row: number) => {
      setHouseContext(false);
      setCurrentRow(Math.min(row, rowCount));
      setHouseInspection({ ...houseInspection, courseOnly: true });
    },
    onInspection: (v: TeplushkaInspection) => {
      setHouseContext(false);
      setHouseInspection(v);
    },
    onGates: props.setDamperOpenings
  };
  const [cutterOpen, setCutterOpen] = useState(false);
  const [panel, setPanel] = useState<
    "tools" | "rows" | "materials" | "part" | "section" | "review" | "guide" | "physics"
  >("rows");
  const [inspectorExpanded, setInspectorExpanded] = useState(false);
  const [hasPhysics, setHasPhysics] = useState(false);
  const [selectParts, setSelectParts] = useState(true);
  const [rowMode, setRowMode] = useState<"through" | "row" | "all">("through");
  const [ghostPrevious, setGhostPrevious] = useState(true);
  const [isolated, setIsolated] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [sceneKey, setSceneKey] = useState(0);
  const [manualSection, setManualSection] = useState<TeplushkaInspection | null>(null);
  const [twoD, setTwoD] = useState(false);
  const [printReady, setPrintReady] = useState(false);
  const [printRow, setPrintRow] = useState(false);
  const [sectionOffset, setSectionOffset] = useState(32.5);
  const locked = lockedRows.includes(currentRow);
  const physicsDocument = useMemo(() => Object.values(rows).flat(), [rows]);
  const visibleDocument = useMemo(
    () =>
      Object.values(rows)
        .flat()
        .filter((brick) => isInsideGrid(brick, grid)),
    [rows, grid]
  );
  const numbers = useMemo(() => partNumbers(physicsDocument), [physicsDocument]);
  const selectedPart = physicsDocument.find((b) => b.id === masonryIds[0]);
  const selectPart = (ids: string[], row: number) => {
    setMasonrySelection({ revision: props.sceneRevision, row, ids });
    setCurrentRow(Math.max(1, Math.min(rowCount, row)));
    setSelectParts(true);
    setHouseContext(false);
  };
  const print = async () => {
    if (props.workspace) {
      try {
        await props.workspace.flush();
      } catch {
        window.alert(
          "Сначала сохраните проект или скачайте его файл: печать должна быть привязана к сохранённой версии."
        );
        return;
      }
    }
    setPrintReady(true);
  };
  useEffect(() => {
    if (!printReady) return;
    const timer = setTimeout(() => window.print(), 100);
    const after = () => setPrintReady(false);
    window.addEventListener("afterprint", after);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", after);
    };
  }, [printReady]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (cutterOpen) return;
      if (target?.isContentEditable || target?.closest("input,textarea,select,dialog,[role=dialog]")) return;
      const key = event.key.toLowerCase();
      if (event.ctrlKey || event.metaKey) {
        if (key === "s") {
          event.preventDefault();
          void props.saveCurrentProject();
        }
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
  }, [undo, redo, orientation, setOrientation, setActiveTool, cutterOpen, props.saveCurrentProject]);
  return (
    <main className="studio-editor">
      {props.workspace?.busy && (
        <output className="workspace-transition">Сохраняю текущую работу и открываю проект…</output>
      )}
      {props.workspace && <ProjectBar workspace={props.workspace} onServerSave={props.onServerSave} />}
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
          {!props.workspace && (
            <button type="button" className="studio-primary" onClick={props.saveCurrentProject}>
              {t("saveProject")}
            </button>
          )}
        </div>
      </div>
      <div className="workspace-modes">
        <button type="button" aria-pressed={selectParts} onClick={() => setSelectParts(true)}>
          Выбор детали
        </button>
        <button
          type="button"
          aria-pressed={!selectParts}
          onClick={() => {
            setSelectParts(false);
            setManualSection(null);
            setPanel("tools");
            setRowMode("through");
            setIsolated(false);
            setHouseInspection({ section: "whole", fraction: 0.4, courseOnly: true });
            props.onExitSection?.();
          }}
        >
          Кладка
        </button>
        {masonryIds.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setMasonrySelection(null);
              setIsolated(false);
              setFocusRequest(0);
            }}
          >
            Снять выбор
          </button>
        )}
        {isolated && (
          <button
            type="button"
            onClick={() => {
              setIsolated(false);
              setFocusRequest(0);
            }}
          >
            Снять изоляцию
          </button>
        )}
      </div>
      <div className="studio-layout">
        <section className="studio-viewport" aria-label={t("editorTitle")}>
          <div className="viewport-switch">
            <button type="button" aria-pressed={!twoD} onClick={() => setTwoD(false)}>
              3D
            </button>
            <button type="button" aria-pressed={twoD} onClick={() => setTwoD(true)}>
              Точное сечение · 2D
            </button>
          </div>
          {twoD ? (
            <ExactSection
              bricks={physicsDocument}
              grid={grid}
              row={currentRow}
              offset={sectionOffset}
              selectedIds={masonryIds}
              onSelect={selectPart}
              previous={ghostPrevious}
              measurement
            />
          ) : (
            <ErrorBoundary
              key={sceneKey}
              fallback={
                <div className="studio-fallback">
                  <p>{t("sceneError")}</p>
                  <button type="button" onClick={() => setSceneKey((k) => k + 1)}>
                    {t("reloadScene")}
                  </button>
                  <button type="button" onClick={() => setTwoD(true)}>
                    Продолжить в 2D
                  </button>
                </div>
              }
            >
              <Suspense fallback={<div className="studio-fallback">{t("loadingScene")}</div>}>
                <ThreeStack
                  key={props.sceneRevision}
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
                  houseContext={isHouse && houseContext}
                  highlightedIds={masonryIds}
                  selectParts={selectParts}
                  onSelectPart={(id) => {
                    const b = physicsDocument.find((b) => b.id === id);
                    if (b) {
                      selectPart([id], b.row);
                      setPanel("part");
                      setInspectorExpanded(true);
                    }
                  }}
                  rowMode={rowMode}
                  ghostPrevious={ghostPrevious}
                  isolateIds={isolated ? masonryIds : undefined}
                  focusRequest={focusRequest}
                  inspection={manualSection ?? (isHouse ? houseInspection : props.inspection)}
                  onExitSection={
                    isHouse
                      ? () => {
                          setHouseContext(false);
                          setHouseInspection({ section: "whole", fraction: 0.4, courseOnly: true });
                        }
                      : props.onExitSection
                  }
                />
              </Suspense>
            </ErrorBoundary>
          )}
        </section>
        <aside className={`studio-inspector${inspectorExpanded ? " is-expanded" : ""}`}>
          <button
            className="mobile-inspector-toggle"
            type="button"
            aria-expanded={inspectorExpanded}
            onClick={() => setInspectorExpanded(!inspectorExpanded)}
          >
            {inspectorExpanded ? "Свернуть панель ↓" : "Инструменты и свойства ↑"}
          </button>
          <fieldset className="studio-panel-tabs" aria-label={t("editorPanels")}>
            {(
              [
                ["rows", "Ряды"],
                ["part", "Деталь"],
                ["section", "Сечение"],
                ["tools", "Кладка"],
                ["review", "Проверки"],
                ["materials", "Выпуск"],
                ["physics", "Физика"],
                ["guide", "О проекте"]
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={panel === key}
                onClick={() => {
                  setInspectorExpanded(true);
                  setPanel(key);
                  if (key === "physics") setHasPhysics(true);
                  if (key === "tools") {
                    setSelectParts(false);
                    setManualSection(null);
                    setRowMode("through");
                    setHouseInspection({ section: "whole", fraction: 0.4, courseOnly: true });
                    props.onExitSection?.();
                  }
                }}
              >
                {label}
              </button>
            ))}
          </fieldset>
          <div className="studio-panel-content">
            {panel === "part" &&
              (selectedPart && props.editPart && props.removePart ? (
                <PartInspector
                  key={JSON.stringify(selectedPart)}
                  brick={selectedPart}
                  number={numbers.get(selectedPart.id) ?? selectedPart.id}
                  locked={lockedRows.includes(selectedPart.row)}
                  rowCount={rowCount}
                  onEdit={props.editPart}
                  onRemove={props.removePart}
                  onFocus={() => {
                    setFocusRequest((v) => v + 1);
                    setTwoD(false);
                  }}
                  onIsolate={() => {
                    setIsolated(!isolated);
                    setFocusRequest((v) => v + 1);
                  }}
                  isolated={isolated}
                  onReview={() => setPanel("review")}
                  onInstallationRow={() => setCurrentRow(selectedPart.row)}
                />
              ) : (
                <p>Выберите кирпич в 3D или на сечении. Его размеры, материал и правки появятся здесь.</p>
              ))}
            {panel === "section" && (
              <>
                <fieldset className="part-fields">
                  <legend>Вертикальный разрез 3D</legend>
                  <label>
                    Плоскость
                    <select
                      value={manualSection?.section ?? "whole"}
                      onChange={(e) => {
                        setManualSection({
                          section: e.target.value as TeplushkaInspection["section"],
                          fraction: 0.4,
                          courseOnly: true,
                          coordinateMm: e.target.value === "side" ? grid.cols * 62.5 : grid.rows * 62.5
                        });
                        setSelectParts(true);
                      }}
                    >
                      <option value="whole">Без разреза</option>
                      <option value="front">Y · спереди</option>
                      <option value="side">X · сбоку</option>
                    </select>
                  </label>
                  {manualSection && manualSection.section !== "whole" && (
                    <label>
                      Координата, мм
                      <input
                        type="number"
                        min="0"
                        max={(manualSection.section === "side" ? grid.cols : grid.rows) * 125}
                        step="1"
                        value={manualSection.coordinateMm ?? 0}
                        onChange={(e) => {
                          if (Number.isFinite(e.target.valueAsNumber))
                            setManualSection({
                              ...manualSection,
                              coordinateMm: Math.max(
                                0,
                                Math.min(
                                  (manualSection.section === "side" ? grid.cols : grid.rows) * 125,
                                  e.target.valueAsNumber
                                )
                              )
                            });
                        }}
                      />
                    </label>
                  )}
                </fieldset>
                <label>
                  Высота в ряду, мм{" "}
                  <input
                    type="number"
                    min="0.1"
                    max="64.9"
                    step="0.1"
                    value={sectionOffset}
                    onChange={(e) => {
                      if (Number.isFinite(e.target.valueAsNumber))
                        setSectionOffset(Math.max(0.1, Math.min(64.9, e.target.valueAsNumber)));
                    }}
                  />
                </label>
                <ExactSection
                  bricks={physicsDocument}
                  grid={grid}
                  row={currentRow}
                  offset={sectionOffset}
                  selectedIds={masonryIds}
                  onSelect={selectPart}
                  previous={ghostPrevious}
                  measurement
                />
                <p>Сечение включает детали из нижних рядов. Ряд установки указан в карточке детали.</p>
              </>
            )}
            {panel === "guide" && isHouse && (
              <HouseRussianGuide
                controls={houseControls}
                project={{
                  rows,
                  parameters: props.parameters,
                  title: {
                    ru: visibleDocument.some((b) => b.id.startsWith("rp54-r2-"))
                      ? "Русская печь · дом 6×9 · R2"
                      : "Русская печь · дом 6×9 · R1",
                    en: "",
                    lt: ""
                  }
                }}
              />
            )}
            {panel === "review" && (
              <MasonryReviewPanel
                key={props.sceneRevision}
                bricks={visibleDocument}
                grid={grid}
                currentRow={currentRow}
                selectedIds={masonryIds.filter((id) => visibleDocument.some((b) => b.id === id))}
                onClear={() => {
                  setMasonrySelection(null);
                  setIsolated(false);
                  setFocusRequest(0);
                }}
                onSelect={(ids, row) => {
                  selectPart(ids, row);
                  setRowMode("through");
                  setFocusRequest((n) => n + 1);
                  setHouseContext(false);
                  setCurrentRow(row);
                  setHouseInspection({ section: "whole", fraction: 0.4, courseOnly: true });
                }}
              />
            )}
            <div hidden={panel !== "physics"}>
              {hasPhysics && (
                <PhysicsReview
                  active={panel === "physics"}
                  initiallyOpen
                  key={props.sceneRevision}
                  bricks={physicsDocument}
                  grid={grid}
                  rowCount={rowCount}
                  onSelect={(ids, row) => {
                    selectPart(ids, row);
                    setRowMode("through");
                    setFocusRequest((n) => n + 1);
                    setCurrentRow(row);
                    if (isHouse) {
                      setHouseContext(false);
                      setHouseInspection({ section: "whole", fraction: 0.4, courseOnly: true });
                    }
                  }}
                />
              )}
            </div>

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
                <div className="studio-segment">
                  {(
                    [
                      ["row", "Только ряд"],
                      ["through", "До ряда"],
                      ["all", "Вся печь"]
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      type="button"
                      key={key}
                      aria-pressed={rowMode === key}
                      onClick={() => {
                        setRowMode(key);
                        setIsolated(false);
                        setFocusRequest(0);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="studio-check">
                  <input type="checkbox" checked={ghostPrevious} onChange={(e) => setGhostPrevious(e.target.checked)} />{" "}
                  Подложка предыдущего ряда
                </label>
                {isHouse && (
                  <div className="part-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentRow(29);
                        setRowMode("through");
                      }}
                    >
                      Корпус · 1–29
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentRow(30);
                        setRowMode("row");
                      }}
                    >
                      Труба · 30–89
                    </button>
                  </div>
                )}
                <p className="studio-muted">
                  В списке — детали, устанавливаемые в ряду. На сечении видны и детали снизу.
                </p>
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
                <label className="studio-check">
                  <input type="checkbox" checked={printRow} onChange={(e) => setPrintRow(e.target.checked)} /> Только
                  текущий ряд
                </label>
                {!isNativeApp() && (
                  <button type="button" onClick={print}>
                    Подготовить точную порядовку
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
      {printReady && (
        <PrintOrder
          title={props.workspace?.info?.title}
          revision={props.workspace?.info?.revision}
          onlyRow={printRow ? currentRow : undefined}
          t={t}
          grid={grid}
          rows={rows}
          rowCount={rowCount}
          lockedRows={lockedRows}
          parameters={props.parameters}
          materials={props.materials}
        />
      )}
    </main>
  );
}
