import type { Locale } from "../i18n";

export type Screen = "parameters" | "projects" | "builder" | "showcase";
export type ViewMode = "2d" | "3d";
export type BrickKind = "standard" | "cut" | "trim" | "firebrick" | "vent" | "cleanout" | "grate" | "rebate" | "plate";
export type ToolKind = "standard" | "cut" | "firebrick" | "vent" | "cleanout" | "grate" | "rebate" | "plate" | "eraser";
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

export type PlacedBrick = {
  id: string;
  x: number;
  y: number;
  row: number;
  kind: BrickKind;
  orientation: Orientation;
  /** Only for kind "rebate": which corner is cut out. */
  notchCorner?: NotchCorner;
};

export type MaterialsEstimate = {
  regularBricks: number;
  cutBricks: number;
  rebatedBricks: number;
  firebricks: number;
  grates: number;
  plates: number;
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
export type BrickFootprint = Pick<PlacedBrick, "x" | "y" | "kind" | "orientation" | "notchCorner">;
