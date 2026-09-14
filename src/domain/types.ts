import type { Locale } from "../i18n";

export type Screen = "parameters" | "projects" | "builder" | "showcase" | "auth";
export type BrickKind =
  | "standard"
  | "cut"
  | "trim"
  | "firebrick"
  | "vent"
  | "cleanout"
  | "grate"
  | "rebate"
  | "plate"
  | "damper"
  | "custom";
export type ToolKind =
  | "standard"
  | "cut"
  | "firebrick"
  | "vent"
  | "cleanout"
  | "grate"
  | "rebate"
  | "plate"
  | "damper"
  | "custom"
  | "eraser";
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
  /** Explicit structural steel part; omitted keeps legacy masonry material. */
  material?: "steel";
  /** габарит после резов, в ячейках */
  w: number;
  h: number;
  /**
   * Convex vertical section of an individual wedge, in millimetres. Local X
   * spans 0..w*125; local Z is relative to the course base (not limited to 65).
   * Extruded along local plan Y by h*125, then rotated by orientation.
   * Only custom solids; incompatible with notches, seats and height overrides.
   */
  profileXZ?: { x: number; z: number }[];
  /** One physical cut brick: connected, non-overlapping boxes in local mm.
   * Z is relative to the course. No mortar exists between these parts.
   * Mutually exclusive with profileXZ, notches and height/seat overrides. */
  solidParts?: { x1: number; y1: number; z1: number; x2: number; y2: number; z2: number }[];
  /** вырез, привязанный к углу заготовки: бокс в координатах заготовки */
  notch?: { x1: number; y1: number; x2: number; y2: number } | null;
  /** true — в вырезе остаётся полка на посадку; false — вырез сквозной */
  ledge?: boolean;
  /** глубина выреза по ВЫСОТЕ кирпича, мм (кирпич 65 мм; 65 = насквозь) */
  notchDepthMm?: number;
  /** вертикальный размер (дверцы): высота проёма в мм, ~70 мм на ряд кладки */
  heightMm?: number;
  /** Damper mounting plane. Vertical means a removable mouth plate lifted by damperOpen × heightMm. */
  damperPlane?: "horizontal" | "vertical";
  /** Direction of a vertical sliding blade in the unrotated local plan, or upward. */
  damperSlide?: "up" | "x-positive" | "x-negative" | "y-positive" | "y-negative";
  /** Vertical default 0 (removable mouth plate); horizontal default 10 mm. Rim lies outside clear aperture. */
  damperFrameMm?: number;
  /** толщина плиты, мм */
  thicknessMm?: number;
  /** плита утоплена заподлицо с верхом ряда (ложится в вырезы кирпичей) */
  flush?: boolean;
  /**
   * Посадка flush-плиты: высота опоры (низа плиты) от низа ряда, мм.
   * Новая установка заподлицо: 65 − толщина, с проверкой контакта с полкой.
   * Сохранённая посадка старых проектов остаётся без изменений при загрузке.
   */
  seatZMm?: number;
  /**
   * Из какого кирпича сделан автоподрез под плиту/колосник: шамот должен
   * остаться шамотом в смете и цвете, а не превратиться в обычный резаный.
   */
  cutFrom?: "standard" | "cut" | "firebrick";
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
  /**
   * Only for kind "damper": степень выдвижения полотна (0 — закрыта, 1 —
   * открыта). Хранится в проекте: витрина показывает печь как оставил автор.
   */
  damperOpen?: number;
};

export type MaterialsEstimate = {
  regularBricks: number;
  cutBricks: number;
  rebatedBricks: number;
  firebricks: number;
  grates: number;
  plates: number;
  doors: number;
  dampers: number;
  /** Вентканалы — размеченные пустоты, материалов не расходуют. */
  vents: number;
  /** Geometric steel parts, not purchased angle-stock quantity. */
  steelPieces?: number;
  /** Approximate mass from actual solid volume and nominal 7850 kg/m³ density. */
  steelKg?: number;
  fullPieces?: number;
  rectangularPieces?: number;
  shapedPieces?: number;
  /** null: joint volume has not been measured; never a per-piece purchasing estimate. */
  mortarM3: number | null;
  concreteVolumeM3: number;
  total: number;
};

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
