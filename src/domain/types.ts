import type { Locale } from "../i18n";

export type Screen = "parameters" | "projects" | "builder";
export type ViewMode = "2d" | "3d";
export type BrickKind = "standard" | "cut" | "trim" | "firebrick" | "vent" | "cleanout" | "grate";
export type ToolKind = "standard" | "cut" | "firebrick" | "vent" | "cleanout" | "grate" | "eraser";
export type Orientation = "h" | "v";

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
};

export type MaterialsEstimate = {
  regularBricks: number;
  cutBricks: number;
  firebricks: number;
  grates: number;
  mortarM3: number;
  concreteVolumeM3: number;
  total: number;
};

export type CameraState = { zoom: number; angle: number; offsetX: number; offsetY: number };

export type ReadyProject = {
  id: string;
  title: Record<Locale, string>;
  subtitle: Record<Locale, string>;
  parameters: Parameters;
  rowCount: number;
  lockedRows: number[];
  rows: Record<number, PlacedBrick[]>;
  accent: string;
};

/** A brick footprint is enough to reason about size, bounds, overlaps and fit. */
export type BrickFootprint = Pick<PlacedBrick, "x" | "y" | "kind" | "orientation">;
