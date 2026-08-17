import { MM_PER_CELL } from "../constants";
import type { CustomBrickSpec } from "../types";

export function plateSpecFromMm(lengthMm: number, widthMm: number, thicknessMm = 14, flush = false): CustomBrickSpec {
  return { name: `Плита ${lengthMm}×${widthMm}×${thicknessMm}`, w: lengthMm / MM_PER_CELL, h: widthMm / MM_PER_CELL, notch: null, thicknessMm, flush };
}
export const DEFAULT_PLATE = plateSpecFromMm(710, 410);

export function doorSpecFromMm(widthMm: number, heightMm: number): CustomBrickSpec {
  return { name: `Дверца ${widthMm}×${heightMm}`, w: widthMm / MM_PER_CELL, h: 1, notch: null, heightMm };
}
export const DEFAULT_DOOR = doorSpecFromMm(250, 210);

export const DAMPER_THICKNESS_MM = 20;
export function damperSpecFromMm(lengthMm: number, widthMm: number): CustomBrickSpec {
  return { name: `Задвижка ${lengthMm}×${widthMm}`, w: lengthMm / MM_PER_CELL, h: widthMm / MM_PER_CELL, notch: null, thicknessMm: DAMPER_THICKNESS_MM };
}
export const DEFAULT_DAMPER = damperSpecFromMm(250, 130);

export function grateSpecFromMm(lengthMm: number, widthMm: number, thicknessMm = 22): CustomBrickSpec {
  return { name: `Колосник ${lengthMm}×${widthMm}×${thicknessMm}`, w: lengthMm / MM_PER_CELL, h: widthMm / MM_PER_CELL, notch: null, thicknessMm };
}
export const DEFAULT_GRATE = grateSpecFromMm(375, 250);
export const DEFAULT_REBATE_DEPTH_MM = 32.5;
