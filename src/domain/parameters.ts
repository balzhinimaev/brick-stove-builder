import type { TranslationKey, Translate } from "../i18n";
import type { Parameters } from "./types";

export type ParameterBound = {
  min: number;
  max: number;
  step: number;
  title: TranslationKey;
  help: TranslationKey;
  icon: string;
};

/** Data-driven replacement for the old `switch` — extend a field by adding a row. */
export const PARAM_BOUNDS: Record<keyof Parameters, ParameterBound> = {
  foundationWidth: { min: 70, max: 220, step: 5, title: "foundationWidthTitle", help: "foundationWidthHelp", icon: "↔" },
  foundationLength: { min: 90, max: 260, step: 5, title: "foundationLengthTitle", help: "foundationLengthHelp", icon: "↕" },
  foundationThickness: { min: 15, max: 45, step: 1, title: "foundationThicknessTitle", help: "foundationThicknessHelp", icon: "▰" },
  roomHeight: { min: 200, max: 360, step: 5, title: "roomHeightTitle", help: "roomHeightHelp", icon: "⌂" }
};

export const PARAMETER_FIELDS = Object.keys(PARAM_BOUNDS) as Array<keyof Parameters>;

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

const MIN_USABLE_HEIGHT_CM = 190;
const MIN_FOOTPRINT_RATIO = 0.42;
const MAX_FOOTPRINT_RATIO = 1.45;

export type Validation = { ok: boolean; message: string };

export function validateParameters(parameters: Parameters, t: Translate): Validation {
  const usableHeight = parameters.roomHeight - parameters.foundationThickness;
  const ratio = parameters.foundationWidth / parameters.foundationLength;
  if (usableHeight < MIN_USABLE_HEIGHT_CM) return { ok: false, message: t("validationHeight") };
  if (ratio < MIN_FOOTPRINT_RATIO || ratio > MAX_FOOTPRINT_RATIO) return { ok: false, message: t("validationFootprint") };
  return { ok: true, message: t("validationOk") };
}
