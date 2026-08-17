import type {
  CameraState,
  CustomBrickSpec,
  GridSpec,
  NotchCorner,
  Orientation,
  Parameters,
  PlacedBrick,
  ReadyProject,
  SnapStep,
  ToolKind,
  ViewMode
} from "../types";

/** The editor document plus current selections. */
export type EditorState = {
  parameters: Parameters;
  grid: GridSpec;
  rowCount: number;
  currentRow: number;
  lockedRows: number[];
  rows: Record<number, PlacedBrick[]>;
  activeTool: ToolKind;
  orientation: Orientation;
  notchCorner: NotchCorner;
  rebateDepthMm: number;
  snapStep: SnapStep;
  customBrick: CustomBrickSpec | null;
  plateSpec: CustomBrickSpec;
  doorSpec: CustomBrickSpec;
  damperSpec: CustomBrickSpec;
  grateSpec: CustomBrickSpec;
  viewMode: ViewMode;
  camera: CameraState;
};

export type DraftSnapshot = Pick<EditorState, "parameters" | "rowCount" | "currentRow" | "lockedRows" | "rows">;

export type PlacementSelection = Pick<
  EditorState,
  "currentRow" | "activeTool" | "orientation" | "notchCorner" | "rebateDepthMm" | "customBrick" | "plateSpec" | "doorSpec" | "damperSpec" | "grateSpec"
>;

export type EditorAction =
  | { type: "setCurrentRow"; row: number }
  | { type: "setTool"; tool: ToolKind }
  | { type: "setOrientation"; orientation: Orientation }
  | { type: "setNotchCorner"; corner: NotchCorner }
  | { type: "setRebateDepth"; depthMm: number }
  | { type: "setSnapStep"; step: SnapStep }
  | { type: "pickCustomBrick"; spec: CustomBrickSpec }
  | { type: "setPlateSize"; lengthMm: number; widthMm: number; thicknessMm: number; flush: boolean }
  | { type: "setDoorSize"; widthMm: number; heightMm: number }
  | { type: "setDamperSize"; lengthMm: number; widthMm: number }
  | { type: "setGrateSize"; lengthMm: number; widthMm: number; thicknessMm: number }
  | { type: "toggleDamper"; id: string }
  | { type: "setViewMode"; mode: ViewMode }
  | { type: "updateParameter"; key: keyof Parameters; value: number }
  | { type: "reset" }
  | { type: "loadProject"; project: ReadyProject }
  | { type: "loadDraft"; draft: DraftSnapshot }
  | { type: "place"; bricks: PlacedBrick[] }
  | { type: "erase"; x: number; y: number }
  | { type: "addRow" }
  | { type: "deleteRow" }
  | { type: "copyRow"; bricks: PlacedBrick[] }
  | { type: "clearRow" }
  | { type: "lockRow" }
  | { type: "unlockRow" }
  | { type: "cameraZoom"; delta: number }
  | { type: "cameraRotate"; delta: number }
  | { type: "cameraPan"; dx: number; dy: number }
  | { type: "cameraReset" };
