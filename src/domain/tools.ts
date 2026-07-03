import { COLORS } from "../theme/colors";
import type { TranslationKey } from "../i18n";
import type { BrickKind, ToolKind } from "./types";

const TOOL_COLORS: Record<ToolKind | BrickKind, string> = {
  standard: COLORS.brickOrange,
  cut: COLORS.cutBrick,
  trim: COLORS.cutBrick,
  rebate: COLORS.rebate,
  firebrick: COLORS.firebrick,
  vent: COLORS.vent,
  cleanout: COLORS.cleanout,
  grate: COLORS.grate,
  plate: COLORS.plate,
  eraser: COLORS.creamDark
};

export function getToolColor(kind: ToolKind | BrickKind): string {
  return TOOL_COLORS[kind];
}

/** Every `ToolKind` is also a translation key, so the label lookup is the identity. */
export const toolLabelKey = (kind: ToolKind): TranslationKey => kind;
