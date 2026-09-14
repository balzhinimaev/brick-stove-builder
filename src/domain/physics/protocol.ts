import type { GridSpec, PlacedBrick } from "../types";
import type { PhysicsModel, PhysicsSettings } from "./model";
import type { PhysicsFrame } from "./simulation";

export type PhysicsCommand =
  | { type: "build"; bricks: PlacedBrick[]; grid: GridSpec; settings: PhysicsSettings }
  | { type: "run" | "pause" | "step" | "reset" | "release" };
export type PhysicsResponse =
  | { type: "model"; model: PhysicsModel }
  | { type: "frame"; frame: PhysicsFrame; running: boolean }
  | { type: "error"; message: string }
  | { type: "status"; text: string };
