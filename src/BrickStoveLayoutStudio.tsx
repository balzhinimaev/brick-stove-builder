import React, { useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera, Text } from "@react-three/drei";

const COLORS = {
  brickRed: "#C1440E",
  brickOrange: "#E9854A",
  cream: "#F5E6C8",
  creamDark: "#E9D0A8",
  charcoal: "#3D2B1F",
  sage: "#8FAF76",
  sageDark: "#5F7E4D",
  mortar: "#F4D9B7",
  firebrick: "#A8321A",
  cutBrick: "#F2A35E",
  vent: "#6B7C85",
  cleanout: "#8B5E3C",
  foundation: "#B8A38D",
  skyCream: "#FFF7E8",
  gridLine: "rgba(61,43,31,0.18)"
};

const translations = {
  ru: {
    appTitle: "Печь по порядовкам",
    projectName: "Ручная раскладка печника",
    reset: "Сброс",
    language: "Язык",
    parametersTab: "Параметры",
    builderTab: "Кладка",
    parametersTitle: "Параметры мастерской",
    parametersSubtitle: "Задайте габариты. Они влияют на сетку, высоту и расчёт материалов.",
    foundationWidthTitle: "Ширина основания",
    foundationWidthHelp: "Ширина рабочей зоны печи в сантиметрах.",
    foundationLengthTitle: "Длина основания",
    foundationLengthHelp: "Длина рабочей зоны печи в сантиметрах.",
    foundationThicknessTitle: "Толщина фундамента",
    foundationThicknessHelp: "Толщина бетонной плиты.",
    roomHeightTitle: "Высота помещения",
    roomHeightHelp: "От верха фундамента до потолка.",
    looksBuildable: "Параметры пригодны",
    checkDimensions: "Проверьте размеры",
    validationHeight: "Полезная высота меньше 190 см. Для демонстрационной кладки это слишком мало.",
    validationFootprint: "Основание слишком вытянуто. Лучше держать пропорции ближе к реальной печи.",
    validationOk: "Можно раскладывать порядовку вручную.",
    startBuild: "Перейти к раскладке",
    editorTitle: "Редактор порядовки",
    editorSubtitle: "Выберите ряд, инструмент и ставьте кирпичи по сетке. 3D построен на Three.js, кирпичи привязаны к той же сетке.",
    rowsRail: "Ряды",
    currentRow: "Ряд",
    addRow: "+ ряд",
    copyPrev: "Копия",
    clearRow: "Очистить",
    completeRow: "Зафиксировать",
    rowCompleted: "Готово",
    tools: "Инструменты",
    orientation: "Ориентация",
    horizontal: "Гориз.",
    vertical: "Вертик.",
    viewMode: "Вид",
    view2d: "2D",
    view3d: "3D",
    paletteHint: "Тап по сетке ставит или заменяет кирпич. Ластик удаляет.",
    standard: "Кирпич",
    cut: "Половинка",
    firebrick: "Шамот",
    vent: "Канал",
    cleanout: "Дверца",
    eraser: "Ластик",
    materialsSnapshot: "Материалы",
    regularBricks: "Обычный кирпич",
    firebricks: "Шамот",
    cutBricks: "Подрезки",
    mortarEstimate: "Раствор",
    foundationConcrete: "Бетон",
    totalPlaced: "Уложено",
    ceilingLimit: "потолок",
    liveSidePreview: "Силуэт",
    gridLabel: "Сетка кладки",
    brickSize: "кирпич 250×120",
    camera: "Камера",
    zoomIn: "+",
    zoomOut: "−",
    rotateLeft: "↺",
    rotateRight: "↻",
    resetCamera: "Сброс",
    zoom: "Масштаб",
    angle: "Угол",
    dragHint: "В 3D: перетаскивание — вращение, колесо/пинч — масштаб, правый drag — сдвиг.",
    true3d: "Three.js",
    alignedGrid: "ячейка 12.5 см",
    ariaPlan: "План ряда печной кладки",
    aria3d: "3D порядовка с размерной сеткой"
  },
  en: {
    appTitle: "Brick Stove Order Builder",
    projectName: "Manual Stove Layout Studio",
    reset: "Reset",
    language: "Language",
    parametersTab: "Parameters",
    builderTab: "Masonry",
    parametersTitle: "Workshop parameters",
    parametersSubtitle: "Set base and room dimensions. They drive grid size, height and material estimates.",
    foundationWidthTitle: "Base width",
    foundationWidthHelp: "Working stove footprint width in centimeters.",
    foundationLengthTitle: "Base length",
    foundationLengthHelp: "Working stove footprint length in centimeters.",
    foundationThicknessTitle: "Foundation thickness",
    foundationThicknessHelp: "Concrete slab thickness.",
    roomHeightTitle: "Room height",
    roomHeightHelp: "From foundation top to ceiling.",
    looksBuildable: "Dimensions work",
    checkDimensions: "Check dimensions",
    validationHeight: "Usable height is under 190 cm. Too low for this demo layout.",
    validationFootprint: "The base is too stretched. Keep proportions closer to a real stove.",
    validationOk: "Ready for manual row-by-row layout.",
    startBuild: "Open layout editor",
    editorTitle: "Stove masonry editor",
    editorSubtitle: "Choose a row and a tool, then place bricks on the grid. 3D uses Three.js, so bricks snap to the same grid.",
    rowsRail: "Rows",
    currentRow: "Row",
    addRow: "+ row",
    copyPrev: "Copy",
    clearRow: "Clear",
    completeRow: "Lock",
    rowCompleted: "Done",
    tools: "Tools",
    orientation: "Orientation",
    horizontal: "Horiz.",
    vertical: "Vert.",
    viewMode: "View",
    view2d: "2D",
    view3d: "3D",
    paletteHint: "Tap the grid to place or replace a brick. Eraser removes it.",
    standard: "Brick",
    cut: "Half",
    firebrick: "Firebrick",
    vent: "Flue",
    cleanout: "Door",
    eraser: "Eraser",
    materialsSnapshot: "Materials",
    regularBricks: "Regular bricks",
    firebricks: "Firebricks",
    cutBricks: "Cuts",
    mortarEstimate: "Mortar",
    foundationConcrete: "Concrete",
    totalPlaced: "Placed",
    ceilingLimit: "ceiling",
    liveSidePreview: "Silhouette",
    gridLabel: "Masonry grid",
    brickSize: "brick 250×120",
    camera: "Camera",
    zoomIn: "+",
    zoomOut: "−",
    rotateLeft: "↺",
    rotateRight: "↻",
    resetCamera: "Reset",
    zoom: "Zoom",
    angle: "Angle",
    dragHint: "In 3D: drag rotates, wheel/pinch zooms, right-drag pans.",
    true3d: "Three.js",
    alignedGrid: "12.5 cm cell",
    ariaPlan: "Top-down stove masonry row plan",
    aria3d: "3D brick order layout with centimeter grid"
  },
  lt: {
    appTitle: "Krosnies eiliavimo kūrimas",
    projectName: "Rankinis krosnininko maketas",
    reset: "Atkurti",
    language: "Kalba",
    parametersTab: "Parametrai",
    builderTab: "Mūras",
    parametersTitle: "Dirbtuvės parametrai",
    parametersSubtitle: "Nustatykite pagrindo ir patalpos matmenis.",
    foundationWidthTitle: "Pagrindo plotis",
    foundationWidthHelp: "Darbinės krosnies zonos plotis centimetrais.",
    foundationLengthTitle: "Pagrindo ilgis",
    foundationLengthHelp: "Darbinės krosnies zonos ilgis centimetrais.",
    foundationThicknessTitle: "Pamato storis",
    foundationThicknessHelp: "Betono plokštės storis.",
    roomHeightTitle: "Patalpos aukštis",
    roomHeightHelp: "Nuo pamato viršaus iki lubų.",
    looksBuildable: "Matmenys tinka",
    checkDimensions: "Patikrinkite matmenis",
    validationHeight: "Naudingas aukštis mažesnis nei 190 cm. Šiam maketui per mažai.",
    validationFootprint: "Pagrindas per daug ištęstas.",
    validationOk: "Galima rankiniu būdu dėlioti eiles.",
    startBuild: "Atidaryti redaktorių",
    editorTitle: "Krosnies mūro redaktorius",
    editorSubtitle: "Pasirinkite eilę ir įrankį, tada dėkite plytas ant tinklelio.",
    rowsRail: "Eilės",
    currentRow: "Eilė",
    addRow: "+ eilė",
    copyPrev: "Kopija",
    clearRow: "Valyti",
    completeRow: "Užrakinti",
    rowCompleted: "Baigta",
    tools: "Įrankiai",
    orientation: "Kryptis",
    horizontal: "Horiz.",
    vertical: "Vert.",
    viewMode: "Vaizdas",
    view2d: "2D",
    view3d: "3D",
    paletteHint: "Bakstelėkite tinklelį, kad padėtumėte arba pakeistumėte plytą.",
    standard: "Plyta",
    cut: "Pusė",
    firebrick: "Šamotinė",
    vent: "Kanalas",
    cleanout: "Durelės",
    eraser: "Trintukas",
    materialsSnapshot: "Medžiagos",
    regularBricks: "Paprastos plytos",
    firebricks: "Šamotinės plytos",
    cutBricks: "Pjautos",
    mortarEstimate: "Skiedinys",
    foundationConcrete: "Betonas",
    totalPlaced: "Sudėta",
    ceilingLimit: "lubos",
    liveSidePreview: "Siluetas",
    gridLabel: "Mūro tinklelis",
    brickSize: "plyta 250×120",
    camera: "Kamera",
    zoomIn: "+",
    zoomOut: "−",
    rotateLeft: "↺",
    rotateRight: "↻",
    resetCamera: "Atkurti",
    zoom: "Mastelis",
    angle: "Kampas",
    dragHint: "3D: tempimas suka, ratukas/pinch priartina.",
    true3d: "Three.js",
    alignedGrid: "12.5 cm langelis",
    ariaPlan: "Viršutinis mūro eilės planas",
    aria3d: "3D eiliavimo maketas su cm tinkleliu"
  }
} as const;

type Locale = keyof typeof translations;
type TranslationKey = keyof typeof translations.ru;
type Screen = "parameters" | "builder";
type ViewMode = "2d" | "3d";
type BrickKind = "standard" | "cut" | "firebrick" | "vent" | "cleanout";
type ToolKind = BrickKind | "eraser";
type Orientation = "h" | "v";
type Parameters = { foundationWidth: number; foundationLength: number; foundationThickness: number; roomHeight: number };
type PlacedBrick = { id: string; x: number; y: number; row: number; kind: BrickKind; orientation: Orientation };
type MaterialsEstimate = { regularBricks: number; cutBricks: number; firebricks: number; mortarM3: number; concreteVolumeM3: number; total: number };
type CameraState = { zoom: number; angle: number; offsetX: number; offsetY: number };

const LOCALES: Locale[] = ["ru", "en", "lt"];
const GRID_COLS = 8;
const GRID_ROWS = 6;
const INITIAL_ROWS = 8;
const CELL_CM = 12.5;
const BRICK_LAYER_HEIGHT = 0.34;
const BRICK_GAP = 0.035;
const TOOLS: ToolKind[] = ["standard", "cut", "firebrick", "vent", "cleanout", "eraser"];
const DEFAULT_PARAMETERS: Parameters = { foundationWidth: 120, foundationLength: 160, foundationThickness: 25, roomHeight: 260 };
const DEFAULT_CAMERA: CameraState = { zoom: 1, angle: 0, offsetX: 0, offsetY: 0 };

function useI18n(locale: Locale) {
  return (key: TranslationKey): string => translations[locale][key] ?? translations.ru[key];
}

function getToolColor(kind: ToolKind | BrickKind): string {
  switch (kind) {
    case "standard": return COLORS.brickOrange;
    case "cut": return COLORS.cutBrick;
    case "firebrick": return COLORS.firebrick;
    case "vent": return COLORS.vent;
    case "cleanout": return COLORS.cleanout;
    case "eraser": return COLORS.creamDark;
  }
}

function toolLabelKey(kind: ToolKind): TranslationKey {
  switch (kind) {
    case "standard": return "standard";
    case "cut": return "cut";
    case "firebrick": return "firebrick";
    case "vent": return "vent";
    case "cleanout": return "cleanout";
    case "eraser": return "eraser";
  }
}

function parameterBounds(key: keyof Parameters) {
  switch (key) {
    case "foundationWidth": return { min: 70, max: 220, step: 5, unit: "cm", title: "foundationWidthTitle" as TranslationKey, help: "foundationWidthHelp" as TranslationKey, icon: "↔" };
    case "foundationLength": return { min: 90, max: 260, step: 5, unit: "cm", title: "foundationLengthTitle" as TranslationKey, help: "foundationLengthHelp" as TranslationKey, icon: "↕" };
    case "foundationThickness": return { min: 15, max: 45, step: 1, unit: "cm", title: "foundationThicknessTitle" as TranslationKey, help: "foundationThicknessHelp" as TranslationKey, icon: "▰" };
    case "roomHeight": return { min: 200, max: 360, step: 5, unit: "cm", title: "roomHeightTitle" as TranslationKey, help: "roomHeightHelp" as TranslationKey, icon: "⌂" };
  }
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function validateParameters(parameters: Parameters, t: (key: TranslationKey) => string) {
  const usableHeight = parameters.roomHeight - parameters.foundationThickness;
  const ratio = parameters.foundationWidth / parameters.foundationLength;
  if (usableHeight < 190) return { ok: false, message: t("validationHeight") };
  if (ratio < 0.42 || ratio > 1.45) return { ok: false, message: t("validationFootprint") };
  return { ok: true, message: t("validationOk") };
}

function brickSizeFor(kind: ToolKind | BrickKind, orientation: Orientation) {
  const isCutLike = kind === "cut" || kind === "cleanout";
  if (orientation === "h") return { w: isCutLike ? 1 : 2, h: 1 };
  return { w: 1, h: isCutLike ? 1 : 2 };
}

function getFootprint(brick: Pick<PlacedBrick, "x" | "y" | "kind" | "orientation">) {
  const size = brickSizeFor(brick.kind, brick.orientation);
  const cells: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < size.h; y += 1) {
    for (let x = 0; x < size.w; x += 1) cells.push({ x: brick.x + x, y: brick.y + y });
  }
  return cells;
}

function isInsideGrid(brick: Pick<PlacedBrick, "x" | "y" | "kind" | "orientation">) {
  return getFootprint(brick).every((cell) => cell.x >= 0 && cell.x < GRID_COLS && cell.y >= 0 && cell.y < GRID_ROWS);
}

function overlaps(a: Pick<PlacedBrick, "x" | "y" | "kind" | "orientation">, b: Pick<PlacedBrick, "x" | "y" | "kind" | "orientation">) {
  const aCells = getFootprint(a);
  const bCells = getFootprint(b);
  return aCells.some((aCell) => bCells.some((bCell) => aCell.x === bCell.x && aCell.y === bCell.y));
}

function placeBrickInRow(rowBricks: PlacedBrick[], draft: PlacedBrick) {
  if (!isInsideGrid(draft)) return rowBricks;
  return [...rowBricks.filter((brick) => !overlaps(brick, draft)), draft];
}

function removeBrickAt(rowBricks: PlacedBrick[], x: number, y: number) {
  return rowBricks.filter((brick) => !getFootprint(brick).some((cell) => cell.x === x && cell.y === y));
}

function estimateMaterials(allBricks: PlacedBrick[], parameters: Parameters): MaterialsEstimate {
  const regularBricks = allBricks.filter((brick) => brick.kind === "standard").length;
  const cutBricks = allBricks.filter((brick) => brick.kind === "cut" || brick.kind === "cleanout").length;
  const firebricks = allBricks.filter((brick) => brick.kind === "firebrick").length;
  const mortarM3 = (regularBricks + firebricks + cutBricks * 0.5) * 0.0016;
  const concreteVolumeM3 = (parameters.foundationWidth / 100) * (parameters.foundationLength / 100) * (parameters.foundationThickness / 100);
  return { regularBricks, cutBricks, firebricks, mortarM3, concreteVolumeM3, total: allBricks.length };
}

function shadeColor(hex: string, percent: number) {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, (num >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
}

function makeDemoRows(): Record<number, PlacedBrick[]> {
  return {
    1: [
      { id: "r1-0", row: 1, x: 1, y: 1, kind: "standard", orientation: "h" },
      { id: "r1-1", row: 1, x: 3, y: 1, kind: "standard", orientation: "h" },
      { id: "r1-2", row: 1, x: 5, y: 1, kind: "standard", orientation: "h" },
      { id: "r1-3", row: 1, x: 1, y: 4, kind: "standard", orientation: "h" },
      { id: "r1-4", row: 1, x: 3, y: 4, kind: "standard", orientation: "h" },
      { id: "r1-5", row: 1, x: 5, y: 4, kind: "standard", orientation: "h" },
      { id: "r1-6", row: 1, x: 1, y: 2, kind: "standard", orientation: "v" },
      { id: "r1-7", row: 1, x: 6, y: 2, kind: "standard", orientation: "v" },
      { id: "r1-8", row: 1, x: 3, y: 2, kind: "vent", orientation: "h" }
    ],
    2: [
      { id: "r2-0", row: 2, x: 1, y: 1, kind: "standard", orientation: "v" },
      { id: "r2-1", row: 2, x: 6, y: 1, kind: "standard", orientation: "v" },
      { id: "r2-2", row: 2, x: 2, y: 1, kind: "firebrick", orientation: "h" },
      { id: "r2-3", row: 2, x: 4, y: 1, kind: "firebrick", orientation: "h" },
      { id: "r2-4", row: 2, x: 2, y: 4, kind: "standard", orientation: "h" },
      { id: "r2-5", row: 2, x: 4, y: 4, kind: "cleanout", orientation: "h" }
    ]
  };
}

function cellToWorld(x: number, z: number) {
  return { x: x - GRID_COLS / 2, z: z - GRID_ROWS / 2 };
}

function brickWorldGeometry(brick: Pick<PlacedBrick, "x" | "y" | "row" | "kind" | "orientation">) {
  const size = brickSizeFor(brick.kind, brick.orientation);
  const center = cellToWorld(brick.x + size.w / 2, brick.y + size.h / 2);
  const y = (brick.row - 0.5) * BRICK_LAYER_HEIGHT;
  return {
    position: [center.x, y, center.z] as [number, number, number],
    scale: [Math.max(0.1, size.w - BRICK_GAP), BRICK_LAYER_HEIGHT * 0.92, Math.max(0.1, size.h - BRICK_GAP)] as [number, number, number]
  };
}

function runSelfTests() {
  console.assert(brickSizeFor("standard", "h").w === 2, "horizontal standard brick should occupy two cells");
  console.assert(brickSizeFor("standard", "v").h === 2, "vertical standard brick should occupy two cells");
  console.assert(isInsideGrid({ x: 6, y: 5, kind: "standard", orientation: "h" }) === true, "x=6 horizontal fits grid");
  console.assert(isInsideGrid({ x: 7, y: 5, kind: "standard", orientation: "h" }) === false, "x=7 horizontal overflows grid");
  console.assert(overlaps({ x: 1, y: 1, kind: "standard", orientation: "h" }, { x: 2, y: 1, kind: "standard", orientation: "v" }) === true, "overlap detection should catch shared cells");
  console.assert(overlaps({ x: 0, y: 0, kind: "cut", orientation: "h" }, { x: 1, y: 0, kind: "standard", orientation: "h" }) === false, "adjacent bricks should not overlap");
  console.assert(placeBrickInRow([], { id: "a", row: 1, x: 1, y: 1, kind: "standard", orientation: "h" }).length === 1, "valid placement should add a brick");
  console.assert(removeBrickAt([{ id: "a", row: 1, x: 1, y: 1, kind: "standard", orientation: "h" }], 2, 1).length === 0, "eraser should remove brick covering tapped cell");
  console.assert(CELL_CM * GRID_COLS === 100, "8 grid cells should equal 100 cm at 12.5 cm scale");
  console.assert(/^#[0-9a-f]{6}$/i.test(shadeColor("#C1440E", -10)), "shadeColor should return a valid hex color");
  const g = brickWorldGeometry({ x: 1, y: 1, row: 2, kind: "standard", orientation: "h" });
  console.assert(g.position[0] === -2 && g.position[2] === -1.5, "3D brick center should align to the same grid coordinates as its footprint");
  console.assert(g.scale[0] > 1.9 && g.scale[2] > 0.9, "3D standard brick should be rendered as a 2x1 cell box with a small mortar gap");
}
runSelfTests();

export default function BrickStoveLayoutStudio() {
  const [locale, setLocale] = useState<Locale>("ru");
  const [screen, setScreen] = useState<Screen>("builder");
  const [viewMode, setViewMode] = useState<ViewMode>("3d");
  const [activeTool, setActiveTool] = useState<ToolKind>("standard");
  const [orientation, setOrientation] = useState<Orientation>("h");
  const [rowCount, setRowCount] = useState(INITIAL_ROWS);
  const [currentRow, setCurrentRow] = useState(2);
  const [lockedRows, setLockedRows] = useState<number[]>([1]);
  const [rows, setRows] = useState<Record<number, PlacedBrick[]>>(makeDemoRows());
  const [parameters, setParameters] = useState<Parameters>(DEFAULT_PARAMETERS);
  const [camera, setCamera] = useState<CameraState>(DEFAULT_CAMERA);
  const idCounter = useRef(0);
  const t = useI18n(locale);
  const allBricks = useMemo(() => Object.values(rows).flat(), [rows]);
  const materials = useMemo(() => estimateMaterials(allBricks, parameters), [allBricks, parameters]);

  const updateParameter = (key: keyof Parameters, value: number) => {
    const bounds = parameterBounds(key);
    setParameters((current) => ({ ...current, [key]: clamp(Math.round(value), bounds.min, bounds.max) }));
  };

  const reset = () => {
    setScreen("builder");
    setViewMode("3d");
    setActiveTool("standard");
    setOrientation("h");
    setRowCount(INITIAL_ROWS);
    setCurrentRow(2);
    setLockedRows([1]);
    setRows(makeDemoRows());
    setParameters(DEFAULT_PARAMETERS);
    setCamera(DEFAULT_CAMERA);
  };

  const placeAt = (x: number, y: number) => {
    if (lockedRows.includes(currentRow)) return;
    setRows((current) => {
      const rowBricks = current[currentRow] ?? [];
      if (activeTool === "eraser") return { ...current, [currentRow]: removeBrickAt(rowBricks, x, y) };
      const draft: PlacedBrick = { id: `r${currentRow}-${idCounter.current++}-${x}-${y}`, row: currentRow, x, y, kind: activeTool, orientation };
      return { ...current, [currentRow]: placeBrickInRow(rowBricks, draft) };
    });
  };

  const addRow = () => {
    const next = rowCount + 1;
    setRowCount(next);
    setCurrentRow(next);
  };

  const copyPreviousRow = () => {
    if (currentRow <= 1 || lockedRows.includes(currentRow)) return;
    const previous = rows[currentRow - 1] ?? [];
    setRows((current) => ({ ...current, [currentRow]: previous.map((brick, index) => ({ ...brick, id: `r${currentRow}-copy-${index}-${idCounter.current++}`, row: currentRow })) }));
  };

  const clearCurrentRow = () => {
    if (lockedRows.includes(currentRow)) return;
    setRows((current) => ({ ...current, [currentRow]: [] }));
  };

  const lockRow = () => {
    setLockedRows((current) => current.includes(currentRow) ? current : [...current, currentRow]);
    setCurrentRow((row) => Math.min(row + 1, rowCount));
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#FFF7E8] px-3 pb-28 pt-3 text-[#3D2B1F] sm:px-4" style={{ fontFamily: "Nunito, ui-rounded, system-ui, sans-serif" }}>
      <div className="mx-auto w-full max-w-[430px]">
        <Header locale={locale} setLocale={setLocale} t={t} reset={reset} placedCount={materials.total} lockedCount={lockedRows.length} />
        <MobileTabs screen={screen} setScreen={setScreen} t={t} />
        {screen === "parameters" ? (
          <ParametersScreen parameters={parameters} updateParameter={updateParameter} t={t} onContinue={() => setScreen("builder")} lockedRows={lockedRows} />
        ) : (
          <BuilderScreen t={t} rows={rows} rowCount={rowCount} currentRow={currentRow} setCurrentRow={setCurrentRow} lockedRows={lockedRows} activeTool={activeTool} setActiveTool={setActiveTool} orientation={orientation} setOrientation={setOrientation} viewMode={viewMode} setViewMode={setViewMode} placeAt={placeAt} addRow={addRow} copyPreviousRow={copyPreviousRow} clearCurrentRow={clearCurrentRow} lockRow={lockRow} parameters={parameters} materials={materials} camera={camera} setCamera={setCamera} />
        )}
      </div>
    </div>
  );
}

function Header({ locale, setLocale, t, reset, placedCount, lockedCount }: { locale: Locale; setLocale: (locale: Locale) => void; t: (key: TranslationKey) => string; reset: () => void; placedCount: number; lockedCount: number }) {
  return (
    <header className="sticky top-2 z-20 rounded-[26px] border-2 border-[#3D2B1F]/15 bg-[#F5E6C8]/95 p-3 shadow-lg shadow-[#3D2B1F]/10 backdrop-blur">
      <div className="flex items-center gap-3">
        <StoveIcon />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-black uppercase tracking-wide text-[#5F7E4D]">{t("appTitle")}</div>
          <h1 className="truncate text-[20px] font-black leading-6 tracking-tight">{t("projectName")}</h1>
          <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none]">
            <Pill>{t("totalPlaced")}: {placedCount}</Pill>
            <Pill>{t("rowsRail")}: {lockedCount}</Pill>
            <Pill>{t("brickSize")}</Pill>
          </div>
        </div>
        <button onClick={reset} className="min-h-11 rounded-full border border-[#3D2B1F]/25 px-3 text-xs font-black">{t("reset")}</button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-[20px] border border-[#3D2B1F]/10 bg-[#FFF7E8]/70 p-1.5">
        {LOCALES.map((item) => <button key={item} onClick={() => setLocale(item)} className={`min-h-9 rounded-2xl px-2 text-xs font-black transition ${locale === item ? "bg-[#3D2B1F] text-[#F5E6C8]" : "bg-[#F5E6C8] text-[#3D2B1F]"}`}>{item.toUpperCase()}</button>)}
      </div>
    </header>
  );
}

function StoveIcon() {
  return (
    <div className="grid h-[58px] w-[58px] shrink-0 place-items-center">
      <svg width="58" height="58" viewBox="0 0 74 74" aria-hidden="true">
        <circle cx="37" cy="37" r="34" fill={COLORS.cream} />
        <rect x="18" y="48" width="38" height="10" rx="3" fill={COLORS.foundation} stroke={COLORS.charcoal} strokeWidth="2" />
        <rect x="20" y="33" width="34" height="16" rx="5" fill={COLORS.brickRed} stroke={COLORS.charcoal} strokeWidth="2" />
        <rect x="24" y="18" width="26" height="15" rx="4" fill={COLORS.brickOrange} stroke={COLORS.charcoal} strokeWidth="2" />
        <rect x="31" y="25" width="12" height="17" rx="5" fill={COLORS.charcoal} />
        <path d="M33 42 C28 34, 42 32, 35 23 C48 32, 47 44, 37 50 C37 45, 34 45, 33 42Z" fill="#FFBF54" />
        <line x1="22" y1="41" x2="52" y2="41" stroke={COLORS.mortar} strokeWidth="2" />
        <line x1="31" y1="33" x2="31" y2="49" stroke={COLORS.mortar} strokeWidth="2" />
        <line x1="43" y1="33" x2="43" y2="49" stroke={COLORS.mortar} strokeWidth="2" />
      </svg>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 rounded-full bg-[#C1440E]/10 px-2.5 py-1 text-[11px] font-extrabold">{children}</span>;
}

function MobileTabs({ screen, setScreen, t }: { screen: Screen; setScreen: (screen: Screen) => void; t: (key: TranslationKey) => string }) {
  return (
    <nav className="mt-3 grid grid-cols-2 gap-2 rounded-[24px] bg-[#3D2B1F]/10 p-1.5">
      <TabButton active={screen === "parameters"} onClick={() => setScreen("parameters")}>{t("parametersTab")}</TabButton>
      <TabButton active={screen === "builder"} onClick={() => setScreen("builder")}>{t("builderTab")}</TabButton>
    </nav>
  );
}

function TabButton({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`min-h-12 rounded-[20px] px-4 text-sm font-black transition ${active ? "bg-[#3D2B1F] text-[#F5E6C8]" : "text-[#3D2B1F]"}`}>{children}</button>;
}

function ParametersScreen({ parameters, updateParameter, t, onContinue, lockedRows }: { parameters: Parameters; updateParameter: (key: keyof Parameters, value: number) => void; t: (key: TranslationKey) => string; onContinue: () => void; lockedRows: number[] }) {
  const valid = useMemo(() => validateParameters(parameters, t), [parameters, t]);
  return (
    <main className="mt-4 space-y-3">
      <SectionTitle title={t("parametersTitle")} subtitle={t("parametersSubtitle")} />
      {(Object.keys(parameters) as Array<keyof Parameters>).map((key) => <ParameterControl key={key} field={key} value={parameters[key]} updateParameter={updateParameter} t={t} />)}
      <div className="flex items-center gap-3 rounded-[26px] border-2 border-[#5F7E4D]/20 bg-[#8FAF76]/20 p-3">
        <BrickMascot valid={valid.ok} />
        <div className="flex-1"><div className="font-black">{valid.ok ? t("looksBuildable") : t("checkDimensions")}</div><p className="mt-1 text-sm font-bold leading-5 text-[#3D2B1F]/70">{valid.message}</p></div>
      </div>
      <div className="rounded-[26px] border-2 border-[#3D2B1F]/10 bg-[#F5E6C8]/80 p-3"><div className="mb-2 text-lg font-black">{t("liveSidePreview")}</div><SideSilhouette parameters={parameters} lockedRows={lockedRows} t={t} /></div>
      <button onClick={onContinue} className="min-h-14 w-full rounded-[22px] bg-[#C1440E] text-base font-black text-[#F5E6C8] shadow-lg shadow-[#C1440E]/25">{t("startBuild")}</button>
    </main>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h2 className="text-[24px] font-black tracking-tight">{title}</h2><p className="mt-1 text-sm font-bold leading-5 text-[#3D2B1F]/70">{subtitle}</p></div>;
}

function ParameterControl({ field, value, updateParameter, t }: { field: keyof Parameters; value: number; updateParameter: (key: keyof Parameters, value: number) => void; t: (key: TranslationKey) => string }) {
  const bounds = parameterBounds(field);
  const ratio = (value - bounds.min) / (bounds.max - bounds.min);
  return (
    <div className="rounded-[24px] border-2 border-[#3D2B1F]/10 bg-[#F5E6C8] p-3 shadow-md shadow-[#3D2B1F]/10">
      <div className="flex gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] border-2 border-[#C1440E]/15 bg-[#C1440E]/10 text-2xl font-black text-[#C1440E]">{bounds.icon}</div>
        <div className="min-w-0 flex-1"><div className="font-black">{t(bounds.title)}</div><div className="text-xs font-bold leading-4 text-[#3D2B1F]/60">{t(bounds.help)}</div></div>
        <label className="flex min-w-[86px] items-center rounded-[17px] border-2 border-[#3D2B1F]/10 bg-[#FFF7E8] px-2 py-1.5">
          <input value={value} onChange={(event) => updateParameter(field, Number(event.target.value.replace(/[^0-9]/g, "")))} inputMode="numeric" className="w-10 bg-transparent text-base font-black outline-none" />
          <span className="text-xs font-black text-[#3D2B1F]/55">{bounds.unit}</span>
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={() => updateParameter(field, value - bounds.step)} className="grid min-h-11 min-w-11 place-items-center rounded-[16px] bg-[#3D2B1F] text-xl font-black text-[#F5E6C8]">−</button>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#3D2B1F]/10"><div className="h-full rounded-full bg-[#8FAF76]" style={{ width: `${Math.max(4, ratio * 100)}%` }} /></div>
        <button onClick={() => updateParameter(field, value + bounds.step)} className="grid min-h-11 min-w-11 place-items-center rounded-[16px] bg-[#3D2B1F] text-xl font-black text-[#F5E6C8]">+</button>
      </div>
    </div>
  );
}

function BrickMascot({ valid }: { valid: boolean }) {
  return <div className="relative h-[62px] w-[72px] shrink-0"><div className="relative mt-3 h-[40px] w-16 rounded-[14px] border-2 border-[#3D2B1F] bg-[#E9854A]"><div className="absolute left-0 right-0 top-[18px] h-[3px] bg-[#F4D9B7]" /><div className="absolute left-[18px] top-3 h-1.5 w-1.5 rounded-full bg-[#3D2B1F]" /><div className="absolute right-[18px] top-3 h-1.5 w-1.5 rounded-full bg-[#3D2B1F]" /><div className={`absolute left-[25px] top-[26px] h-2 w-3.5 rounded-full border-[#3D2B1F] ${valid ? "border-b-2" : "border-t-2"}`} /></div><div className={`absolute right-0 top-4 text-2xl font-black ${valid ? "-rotate-12" : "rotate-12"}`}>{valid ? "👍" : "!"}</div></div>;
}

function BuilderScreen(props: { t: (key: TranslationKey) => string; rows: Record<number, PlacedBrick[]>; rowCount: number; currentRow: number; setCurrentRow: (row: number) => void; lockedRows: number[]; activeTool: ToolKind; setActiveTool: (tool: ToolKind) => void; orientation: Orientation; setOrientation: (orientation: Orientation) => void; viewMode: ViewMode; setViewMode: (mode: ViewMode) => void; placeAt: (x: number, y: number) => void; addRow: () => void; copyPreviousRow: () => void; clearCurrentRow: () => void; lockRow: () => void; parameters: Parameters; materials: MaterialsEstimate; camera: CameraState; setCamera: React.Dispatch<React.SetStateAction<CameraState>> }) {
  const { t, rows, rowCount, currentRow, setCurrentRow, lockedRows, activeTool, setActiveTool, orientation, setOrientation, viewMode, setViewMode, placeAt, addRow, copyPreviousRow, clearCurrentRow, lockRow, parameters, materials, camera, setCamera } = props;
  const currentBricks = rows[currentRow] ?? [];
  const visibleBricks = Object.values(rows).flat().filter((brick) => brick.row <= currentRow);
  return (
    <main className="mt-4 space-y-3">
      <SectionTitle title={t("editorTitle")} subtitle={t("editorSubtitle")} />
      <div className="flex flex-wrap gap-2"><Pill>{t("currentRow")}: {currentRow}</Pill><Pill>{t("totalPlaced")}: {currentBricks.length}</Pill><Pill>{t("true3d")}</Pill><Pill>{t("alignedGrid")}</Pill></div>
      <MobileRowRail rowCount={rowCount} currentRow={currentRow} lockedRows={lockedRows} setCurrentRow={setCurrentRow} t={t} addRow={addRow} />
      <Toolbox t={t} activeTool={activeTool} setActiveTool={setActiveTool} orientation={orientation} setOrientation={setOrientation} viewMode={viewMode} setViewMode={setViewMode} />
      {viewMode === "3d" && <CameraControls t={t} camera={camera} setCamera={setCamera} />}
      <div className="rounded-[26px] border-2 border-[#3D2B1F]/10 bg-[#F5E6C8] p-2 shadow-md shadow-[#3D2B1F]/10">
        {viewMode === "2d" ? <PlanGrid bricks={currentBricks} activeTool={activeTool} orientation={orientation} placeAt={placeAt} t={t} /> : <ThreeStack bricks={visibleBricks} currentRow={currentRow} placeAt={placeAt} t={t} camera={camera} />}
      </div>
      <MobileActionBar t={t} currentRow={currentRow} lockedRows={lockedRows} copyPreviousRow={copyPreviousRow} clearCurrentRow={clearCurrentRow} lockRow={lockRow} />
      <div className="rounded-[26px] border-2 border-[#3D2B1F]/10 bg-[#FFF7E8] p-3"><div className="mb-2 text-lg font-black">{t("liveSidePreview")}</div><SideSilhouette parameters={parameters} lockedRows={lockedRows} t={t} /><MaterialsSummary materials={materials} t={t} /></div>
    </main>
  );
}

function MobileRowRail({ rowCount, currentRow, lockedRows, setCurrentRow, t, addRow }: { rowCount: number; currentRow: number; lockedRows: number[]; setCurrentRow: (row: number) => void; t: (key: TranslationKey) => string; addRow: () => void }) {
  return (
    <section className="rounded-[24px] border-2 border-[#3D2B1F]/10 bg-[#F5E6C8] p-2">
      <div className="mb-2 flex items-center justify-between px-1"><div className="text-xs font-black uppercase tracking-wide text-[#3D2B1F]/55">{t("rowsRail")}</div><button onClick={addRow} className="min-h-9 rounded-2xl bg-[#C1440E] px-3 text-xs font-black text-[#F5E6C8]">{t("addRow")}</button></div>
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
        {Array.from({ length: rowCount }).map((_, index) => {
          const row = index + 1;
          const active = row === currentRow;
          const locked = lockedRows.includes(row);
          return <button key={row} onClick={() => setCurrentRow(row)} className={`grid min-h-12 min-w-12 place-items-center rounded-2xl border-2 text-sm font-black transition ${active ? "border-[#3D2B1F] bg-[#3D2B1F] text-[#F5E6C8]" : locked ? "border-[#5F7E4D]/30 bg-[#8FAF76] text-[#3D2B1F]" : "border-[#3D2B1F]/10 bg-[#FFF7E8] text-[#3D2B1F]"}`}>{locked ? "✓" : row}</button>;
        })}
      </div>
    </section>
  );
}

function Toolbox({ t, activeTool, setActiveTool, orientation, setOrientation, viewMode, setViewMode }: { t: (key: TranslationKey) => string; activeTool: ToolKind; setActiveTool: (tool: ToolKind) => void; orientation: Orientation; setOrientation: (orientation: Orientation) => void; viewMode: ViewMode; setViewMode: (mode: ViewMode) => void }) {
  return (
    <section className="space-y-2">
      <div className="rounded-[24px] border-2 border-[#3D2B1F]/10 bg-[#FFF7E8] p-2">
        <div className="mb-2 px-1 text-xs font-black uppercase tracking-wide text-[#3D2B1F]/55">{t("tools")}</div>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
          {TOOLS.map((tool) => <button key={tool} onClick={() => setActiveTool(tool)} className={`min-h-[58px] min-w-[78px] rounded-2xl border-2 px-2 text-[11px] font-black transition ${activeTool === tool ? "border-[#3D2B1F] bg-[#3D2B1F] text-[#F5E6C8]" : "border-[#3D2B1F]/10 bg-[#F5E6C8] text-[#3D2B1F]"}`}><span className="mx-auto mb-1 block h-4 w-9 rounded-md border border-[#3D2B1F]/40" style={{ backgroundColor: getToolColor(tool) }} />{t(toolLabelKey(tool))}</button>)}
        </div>
        <p className="mt-1 px-1 text-xs font-bold leading-4 text-[#3D2B1F]/65">{t("paletteHint")}</p>
      </div>
      <div className="grid grid-cols-2 gap-2"><Segmented title={t("orientation")} options={[{ key: "h", label: t("horizontal") }, { key: "v", label: t("vertical") }]} value={orientation} onChange={(value) => setOrientation(value as Orientation)} /><Segmented title={t("viewMode")} options={[{ key: "2d", label: t("view2d") }, { key: "3d", label: t("view3d") }]} value={viewMode} onChange={(value) => setViewMode(value as ViewMode)} /></div>
    </section>
  );
}

function Segmented({ title, options, value, onChange }: { title: string; options: Array<{ key: string; label: string }>; value: string; onChange: (value: string) => void }) {
  return <div className="rounded-[22px] border border-[#3D2B1F]/10 bg-[#FFF7E8] p-2"><div className="mb-2 px-1 text-[11px] font-black uppercase tracking-wide text-[#3D2B1F]/55">{title}</div><div className="grid grid-cols-2 gap-1.5">{options.map((option) => <button key={option.key} onClick={() => onChange(option.key)} className={`min-h-10 rounded-2xl px-2 text-[11px] font-black transition ${value === option.key ? "bg-[#3D2B1F] text-[#F5E6C8]" : "bg-[#F5E6C8] text-[#3D2B1F]"}`}>{option.label}</button>)}</div></div>;
}

function CameraControls({ t, camera, setCamera }: { t: (key: TranslationKey) => string; camera: CameraState; setCamera: React.Dispatch<React.SetStateAction<CameraState>> }) {
  const changeZoom = (delta: number) => setCamera((current) => ({ ...current, zoom: clamp(Number((current.zoom + delta).toFixed(2)), 0.65, 1.55) }));
  const rotate = (delta: number) => setCamera((current) => ({ ...current, angle: (current.angle + delta + 360) % 360 }));
  const pan = (dx: number, dy: number) => setCamera((current) => ({ ...current, offsetX: current.offsetX + dx, offsetY: current.offsetY + dy }));
  return (
    <section className="rounded-[24px] border-2 border-[#3D2B1F]/10 bg-[#FFF7E8] p-2">
      <div className="mb-2 flex items-center justify-between gap-2"><div className="px-1 text-xs font-black uppercase tracking-wide text-[#3D2B1F]/55">{t("camera")}</div><div className="text-[11px] font-black text-[#5F7E4D]">{t("zoom")}: {Math.round(camera.zoom * 100)}% · {t("angle")}: {Math.round(camera.angle)}°</div></div>
      <div className="grid grid-cols-4 gap-2"><CameraButton onClick={() => changeZoom(-0.08)}>{t("zoomOut")}</CameraButton><CameraButton onClick={() => changeZoom(0.08)}>{t("zoomIn")}</CameraButton><CameraButton onClick={() => rotate(-15)}>{t("rotateLeft")}</CameraButton><CameraButton onClick={() => rotate(15)}>{t("rotateRight")}</CameraButton></div>
      <div className="mt-2 grid grid-cols-5 gap-2"><CameraButton onClick={() => pan(-0.25, 0)}>←</CameraButton><CameraButton onClick={() => pan(0, -0.25)}>↑</CameraButton><CameraButton onClick={() => setCamera(DEFAULT_CAMERA)}>{t("resetCamera")}</CameraButton><CameraButton onClick={() => pan(0, 0.25)}>↓</CameraButton><CameraButton onClick={() => pan(0.25, 0)}>→</CameraButton></div>
      <p className="mt-2 px-1 text-[11px] font-bold leading-4 text-[#3D2B1F]/65">{t("dragHint")}</p>
    </section>
  );
}

function CameraButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="min-h-11 rounded-[16px] border border-[#3D2B1F]/10 bg-[#F5E6C8] px-2 text-sm font-black text-[#3D2B1F]">{children}</button>;
}

function PlanGrid({ bricks, activeTool, orientation, placeAt, t }: { bricks: PlacedBrick[]; activeTool: ToolKind; orientation: Orientation; placeAt: (x: number, y: number) => void; t: (key: TranslationKey) => string }) {
  const cell = 34;
  const pad = 28;
  const width = GRID_COLS * cell + pad * 2;
  const height = GRID_ROWS * cell + pad * 2 + 26;
  const ghost = activeTool === "eraser" ? null : brickSizeFor(activeTool, orientation);
  return (
    <div className="w-full overflow-x-auto rounded-[22px] bg-[#FFF7E8]">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-label={t("ariaPlan")}>
        <rect x="1" y="1" width={width - 2} height={height - 2} rx="22" fill={COLORS.cream} stroke={COLORS.charcoal} strokeWidth="2" opacity="0.28" />
        <text x="16" y="22" fontSize="12" fontWeight="900" fill={COLORS.charcoal}>{t("gridLabel")}</text>
        {Array.from({ length: GRID_COLS + 1 }).map((_, x) => <line key={`vx-${x}`} x1={pad + x * cell} y1={pad + 26} x2={pad + x * cell} y2={pad + 26 + GRID_ROWS * cell} stroke={COLORS.gridLine} strokeWidth="1" />)}
        {Array.from({ length: GRID_ROWS + 1 }).map((_, y) => <line key={`hy-${y}`} x1={pad} y1={pad + 26 + y * cell} x2={pad + GRID_COLS * cell} y2={pad + 26 + y * cell} stroke={COLORS.gridLine} strokeWidth="1" />)}
        {Array.from({ length: GRID_COLS + 1 }).map((_, x) => <text key={`xl-${x}`} x={pad + x * cell - 7} y={pad + 18} fontSize="8" fontWeight="800" fill={COLORS.sageDark}>{x * CELL_CM}</text>)}
        {Array.from({ length: GRID_ROWS + 1 }).map((_, y) => <text key={`yl-${y}`} x={5} y={pad + 30 + y * cell} fontSize="8" fontWeight="800" fill={COLORS.sageDark}>{y * CELL_CM}см</text>)}
        {bricks.map((brick) => <Brick2D key={brick.id} brick={brick} cell={cell} pad={pad} />)}
        {ghost && <rect x={pad + 0.2 * cell} y={pad + 26 + 0.2 * cell} width={ghost.w * cell - 6} height={ghost.h * cell - 6} rx="10" fill={getToolColor(activeTool)} opacity="0.28" stroke={COLORS.charcoal} strokeDasharray="4 4" />}
        {Array.from({ length: GRID_ROWS }).flatMap((_, y) => Array.from({ length: GRID_COLS }).map((__, x) => <rect key={`tap-${x}-${y}`} x={pad + x * cell} y={pad + 26 + y * cell} width={cell} height={cell} fill="transparent" className="cursor-pointer" onClick={() => placeAt(x, y)} />))}
      </svg>
    </div>
  );
}

function Brick2D({ brick, cell, pad }: { brick: PlacedBrick; cell: number; pad: number }) {
  const size = brickSizeFor(brick.kind, brick.orientation);
  const x = pad + brick.x * cell + 3;
  const y = pad + 26 + brick.y * cell + 3;
  const w = size.w * cell - 6;
  const h = size.h * cell - 6;
  const fill = getToolColor(brick.kind);
  return <g><rect x={x + 3} y={y + 4} width={w} height={h} rx="10" fill="rgba(61,43,31,0.14)" /><rect x={x} y={y} width={w} height={h} rx="10" fill={fill} stroke={COLORS.charcoal} strokeWidth="2" /><path d={`M${x + 7} ${y + h * 0.45} C${x + w * 0.35} ${y + h * 0.54}, ${x + w * 0.7} ${y + h * 0.35}, ${x + w - 7} ${y + h * 0.48}`} stroke={COLORS.mortar} strokeWidth="2" fill="none" opacity="0.7" />{brick.kind === "vent" && <text x={x + w / 2} y={y + h / 2 + 5} textAnchor="middle" fontSize="16" fontWeight="900" fill={COLORS.cream}>V</text>}{brick.kind === "cleanout" && <text x={x + w / 2} y={y + h / 2 + 5} textAnchor="middle" fontSize="16" fontWeight="900" fill={COLORS.cream}>D</text>}</g>;
}

function ThreeStack({ bricks, currentRow, placeAt, t, camera }: { bricks: PlacedBrick[]; currentRow: number; placeAt: (x: number, y: number) => void; t: (key: TranslationKey) => string; camera: CameraState }) {
  const sorted = useMemo(() => [...bricks].sort((a, b) => a.row - b.row || a.y - b.y || a.x - b.x), [bricks]);
  const gridY = (currentRow - 1) * BRICK_LAYER_HEIGHT + 0.006;
  return (
    <div className="relative h-[390px] overflow-hidden rounded-[22px] bg-[#FFF7E8]" aria-label={t("aria3d")}>
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-2xl border border-[#3D2B1F]/10 bg-[#F5E6C8]/90 px-3 py-2 text-xs font-black shadow-sm">{t("view3d")} · {GRID_COLS * CELL_CM}×{GRID_ROWS * CELL_CM} см</div>
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}>
        <color attach="background" args={[COLORS.skyCream]} />
        <ambientLight intensity={1.15} />
        <directionalLight position={[4, 8, 5]} intensity={1.2} castShadow />
        <OrthographicCamera makeDefault position={[6.8, 6.2, 7.2]} zoom={52 * camera.zoom} />
        <OrbitControls enableDamping dampingFactor={0.12} enableRotate enableZoom enablePan minZoom={25} maxZoom={120} target={[camera.offsetX, BRICK_LAYER_HEIGHT * currentRow * 0.45, camera.offsetY]} />
        <group rotation={[0, (camera.angle * Math.PI) / 180, 0]} position={[camera.offsetX, 0, camera.offsetY]}>
          <FoundationSlab />
          <ThreeGrid gridY={gridY} />
          <DimensionLabels gridY={gridY} />
          {sorted.map((brick) => <ThreeBrick key={brick.id} brick={brick} currentRow={currentRow} />)}
          <PlacementCells currentRow={currentRow} placeAt={placeAt} />
        </group>
      </Canvas>
    </div>
  );
}

function FoundationSlab() {
  return <mesh position={[0, -0.08, 0]} receiveShadow><boxGeometry args={[GRID_COLS + 0.4, 0.12, GRID_ROWS + 0.4]} /><meshStandardMaterial color={COLORS.foundation} roughness={0.88} /></mesh>;
}

function ThreeGrid({ gridY }: { gridY: number }) {
  return (
    <group>
      {Array.from({ length: GRID_COLS + 1 }).map((_, x) => { const world = cellToWorld(x, 0); return <mesh key={`grid-x-${x}`} position={[world.x, gridY, 0]}><boxGeometry args={[0.012, 0.012, GRID_ROWS]} /><meshBasicMaterial color={COLORS.sageDark} transparent opacity={0.45} /></mesh>; })}
      {Array.from({ length: GRID_ROWS + 1 }).map((_, z) => { const world = cellToWorld(0, z); return <mesh key={`grid-z-${z}`} position={[0, gridY, world.z]}><boxGeometry args={[GRID_COLS, 0.012, 0.012]} /><meshBasicMaterial color={COLORS.sageDark} transparent opacity={0.45} /></mesh>; })}
    </group>
  );
}

function DimensionLabels({ gridY }: { gridY: number }) {
  return (
    <group>
      <Text position={[0, gridY + 0.04, GRID_ROWS / 2 + 0.48]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.22} color={COLORS.charcoal} anchorX="center" anchorY="middle">{GRID_COLS * CELL_CM} см</Text>
      <Text position={[-GRID_COLS / 2 - 0.5, gridY + 0.04, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} fontSize={0.22} color={COLORS.charcoal} anchorX="center" anchorY="middle">{GRID_ROWS * CELL_CM} см</Text>
      {Array.from({ length: GRID_COLS + 1 }).map((_, x) => { const world = cellToWorld(x, GRID_ROWS); return <Text key={`x-label-${x}`} position={[world.x, gridY + 0.04, world.z + 0.18]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.14} color={COLORS.sageDark}>{x * CELL_CM}</Text>; })}
      {Array.from({ length: GRID_ROWS + 1 }).map((_, z) => { const world = cellToWorld(0, z); return <Text key={`z-label-${z}`} position={[-GRID_COLS / 2 - 0.22, gridY + 0.04, world.z]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} fontSize={0.14} color={COLORS.sageDark}>{z * CELL_CM}</Text>; })}
    </group>
  );
}

function ThreeBrick({ brick, currentRow }: { brick: PlacedBrick; currentRow: number }) {
  const geometry = brickWorldGeometry(brick);
  const color = getToolColor(brick.kind);
  const isCurrent = brick.row === currentRow;
  const label = brick.kind === "vent" ? "V" : brick.kind === "cleanout" ? "D" : "";
  return (
    <group>
      <mesh position={geometry.position} castShadow receiveShadow><boxGeometry args={geometry.scale} /><meshStandardMaterial color={color} roughness={0.82} metalness={0.02} /></mesh>
      <mesh position={[geometry.position[0], geometry.position[1] + geometry.scale[1] / 2 + 0.006, geometry.position[2]]}><boxGeometry args={[geometry.scale[0] * 0.96, 0.01, geometry.scale[2] * 0.08]} /><meshBasicMaterial color={COLORS.mortar} transparent opacity={0.65} /></mesh>
      {isCurrent && <mesh position={[geometry.position[0], geometry.position[1] + geometry.scale[1] / 2 + 0.014, geometry.position[2]]}><boxGeometry args={[geometry.scale[0] + 0.035, 0.018, geometry.scale[2] + 0.035]} /><meshBasicMaterial color={COLORS.sage} transparent opacity={0.23} /></mesh>}
      {label && <Text position={[geometry.position[0], geometry.position[1] + geometry.scale[1] / 2 + 0.025, geometry.position[2]]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.28} color={COLORS.cream} anchorX="center" anchorY="middle">{label}</Text>}
    </group>
  );
}

function PlacementCells({ currentRow, placeAt }: { currentRow: number; placeAt: (x: number, y: number) => void }) {
  const gridY = (currentRow - 1) * BRICK_LAYER_HEIGHT + 0.02;
  return (
    <group>
      {Array.from({ length: GRID_ROWS }).flatMap((_, y) => Array.from({ length: GRID_COLS }).map((__, x) => { const world = cellToWorld(x + 0.5, y + 0.5); return <mesh key={`cell-${x}-${y}`} position={[world.x, gridY, world.z]} rotation={[-Math.PI / 2, 0, 0]} onClick={(event) => { event.stopPropagation(); placeAt(x, y); }}><planeGeometry args={[0.96, 0.96]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>; }))}
    </group>
  );
}

function MobileActionBar({ t, currentRow, lockedRows, copyPreviousRow, clearCurrentRow, lockRow }: { t: (key: TranslationKey) => string; currentRow: number; lockedRows: number[]; copyPreviousRow: () => void; clearCurrentRow: () => void; lockRow: () => void }) {
  return <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#3D2B1F]/10 bg-[#FFF7E8]/95 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 backdrop-blur"><div className="mx-auto grid max-w-[430px] grid-cols-3 gap-2"><button onClick={copyPreviousRow} className="min-h-12 rounded-[18px] border-2 border-[#3D2B1F]/10 bg-[#F5E6C8] px-2 text-xs font-black">{t("copyPrev")}</button><button onClick={clearCurrentRow} className="min-h-12 rounded-[18px] border-2 border-[#3D2B1F]/10 bg-[#F5E6C8] px-2 text-xs font-black">{t("clearRow")}</button><button onClick={lockRow} className={`min-h-12 rounded-[18px] px-2 text-xs font-black text-[#F5E6C8] ${lockedRows.includes(currentRow) ? "bg-[#5F7E4D]" : "bg-[#C1440E]"}`}>{lockedRows.includes(currentRow) ? t("rowCompleted") : t("completeRow")}</button></div></div>;
}

function SideSilhouette({ parameters, lockedRows, t }: { parameters: Parameters; lockedRows: number[]; t: (key: TranslationKey) => string }) {
  const foundationHeight = Math.max(18, parameters.foundationThickness * 0.75);
  const stoveWidth = Math.min(150, Math.max(88, parameters.foundationWidth * 0.9));
  const x = 96 - stoveWidth / 2;
  const baseY = 190;
  const ceilingY = Math.max(20, baseY - (parameters.roomHeight / 360) * 150);
  return <div className="overflow-hidden rounded-[24px] border-2 border-[#3D2B1F]/10 bg-[#FFF7E8]"><svg width="100%" height="220" viewBox="0 0 192 220"><rect width="192" height="220" rx="24" fill={COLORS.skyCream} /><line x1="18" y1={ceilingY} x2="174" y2={ceilingY} stroke={COLORS.sageDark} strokeWidth="2" strokeDasharray="6 5" /><text x="22" y={ceilingY - 6} fill={COLORS.sageDark} fontSize="10" fontWeight="800">{t("ceilingLimit")}</text><rect x={x - 12} y={baseY} width={stoveWidth + 24} height={foundationHeight} rx="8" fill={COLORS.foundation} stroke={COLORS.charcoal} strokeWidth="2" />{Array.from({ length: Math.max(8, lockedRows.length + 2) }).map((_, index) => { const row = index + 1; const locked = lockedRows.includes(row); const y = baseY - row * 11; return <rect key={row} x={x} y={y} width={stoveWidth} height="10" rx="3" fill={locked ? COLORS.brickRed : COLORS.creamDark} stroke={locked ? COLORS.mortar : "rgba(61,43,31,0.15)"} strokeWidth="1" opacity={locked ? 1 : 0.42} />; })}<path d="M42 42 C35 30, 52 28, 45 16 C60 28, 58 45, 45 52 C46 46, 42 45, 42 42Z" fill="#FFBF54" opacity="0.9" /></svg></div>;
}

function MaterialsSummary({ materials, t }: { materials: MaterialsEstimate; t: (key: TranslationKey) => string }) {
  return <div className="mt-3 rounded-[24px] border-2 border-[#3D2B1F]/10 bg-[#F5E6C8] p-3"><div className="mb-2 text-lg font-black">{t("materialsSnapshot")}</div><MaterialRow label={t("regularBricks")} value={materials.regularBricks} /><MaterialRow label={t("firebricks")} value={materials.firebricks} /><MaterialRow label={t("cutBricks")} value={materials.cutBricks} /><MaterialRow label={t("mortarEstimate")} value={`${materials.mortarM3.toFixed(2)} m³`} /><MaterialRow label={t("foundationConcrete")} value={`${materials.concreteVolumeM3.toFixed(2)} m³`} /></div>;
}

function MaterialRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex justify-between gap-3 border-b border-[#3D2B1F]/10 py-1 text-sm"><span className="font-extrabold text-[#3D2B1F]/70">{label}</span><span className="font-black">{value}</span></div>;
}
