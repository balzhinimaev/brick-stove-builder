import type { Locale } from "../i18n";

export type Screen = "parameters" | "projects" | "builder" | "showcase";
export type ViewMode = "2d" | "3d";
export type BrickKind = "standard" | "cut" | "trim" | "firebrick" | "vent" | "cleanout" | "grate" | "rebate" | "plate" | "custom";
export type ToolKind = "standard" | "cut" | "firebrick" | "vent" | "cleanout" | "grate" | "rebate" | "plate" | "custom" | "eraser";
export type Orientation = "h" | "v";
/** Шаг привязки клика к сетке: целая ячейка или полячейки (четверть кирпича). */
export type SnapStep = 1 | 0.5;
/**
 * Где выбрана четверть (посадочное место): угол (четверть габарита) или
 * грань (паз глубиной полячейки вдоль всей стороны — под колосник/плиту).
 */
export type NotchCorner = "nw" | "ne" | "sw" | "se" | "n" | "e" | "s" | "w";

export type Parameters = {
  foundationWidth: number;
  foundationLength: number;
  foundationThickness: number;
  roomHeight: number;
};

export type GridSpec = { cols: number; rows: number; widthCm: number; lengthCm: number };

/**
 * Кирпич, «нарезанный» в резаке. Размеры в ячейках сетки (1 ячейка = 125 мм),
 * геометрия описана для горизонтальной ориентации заготовки; при установке
 * вертикально поворачивается на 90°.
 */
export type CustomBrickSpec = {
  name: string;
  /** габарит после резов, в ячейках */
  w: number;
  h: number;
  /** вырез, привязанный к углу заготовки: бокс в координатах заготовки */
  notch?: { x1: number; y1: number; x2: number; y2: number } | null;
  /** true — в вырезе остаётся полка на посадку; false — вырез сквозной */
  ledge?: boolean;
  /** глубина выреза по ВЫСОТЕ кирпича, мм (кирпич 65 мм; 65 = насквозь) */
  notchDepthMm?: number;
  /** вертикальный размер (дверцы): высота проёма в мм, ~70 мм на ряд кладки */
  heightMm?: number;
  /** толщина плиты, мм */
  thicknessMm?: number;
  /** плита утоплена заподлицо с верхом ряда (ложится в вырезы кирпичей) */
  flush?: boolean;
};

export type PlacedBrick = {
  id: string;
  x: number;
  y: number;
  row: number;
  kind: BrickKind;
  orientation: Orientation;
  /** Only for kind "rebate": which corner is cut out. */
  notchCorner?: NotchCorner;
  /** Only for kind "custom": форма из резака. */
  custom?: CustomBrickSpec;
};

export type MaterialsEstimate = {
  regularBricks: number;
  cutBricks: number;
  rebatedBricks: number;
  firebricks: number;
  grates: number;
  plates: number;
  doors: number;
  mortarM3: number;
  concreteVolumeM3: number;
  total: number;
};

export type CameraState = { zoom: number; angle: number; offsetX: number; offsetY: number };

export type ShowcaseInfo = {
  published: boolean;
  description: string;
  price: number | null;
  region: string;
  publishedAt?: string | null;
};

export type ReadyProject = {
  id: string;
  title: Record<Locale, string>;
  subtitle: Record<Locale, string>;
  parameters: Parameters;
  rowCount: number;
  lockedRows: number[];
  rows: Record<number, PlacedBrick[]>;
  accent: string;
  /** Present on API-backed projects; absent on bundled demo layouts. */
  ownerLogin?: string;
  showcase?: ShowcaseInfo;
};

/** A brick footprint is enough to reason about size, bounds, overlaps and fit. */
export type BrickFootprint = Pick<PlacedBrick, "x" | "y" | "kind" | "orientation" | "notchCorner" | "custom">;
