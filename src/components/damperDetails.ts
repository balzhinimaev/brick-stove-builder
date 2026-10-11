import { COURSE_MM, damperParts } from "../domain/geometry";
import type { PlacedBrick } from "../domain/types";
import type { Translate, TranslationKey } from "../i18n";

const knownNames: Record<string, TranslationKey> = {
  "rp54-upper-loop-gate": "damperUpperLoop",
  "rp54-direct-gate": "damperDirect",
  "rp54-hob-gate": "damperHob"
};
/** Preset identity is a name only: all numeric details come from the selected saved solid. */
export function damperName(brick: PlacedBrick, t: Translate): string {
  const name = brick.custom?.name;
  const key = knownNames[brick.id];
  if (key && (!name || name === brick.id.slice(5))) return t(key);
  return name ? `${t("damper")} · ${name}` : t("damper");
}
export function damperBladeDetails(brick: PlacedBrick) {
  const blade = damperParts(brick).find((p) => p.role === "blade")!.solid;
  const base = (brick.row - 1) * COURSE_MM;
  const bottom = base + blade.z1,
    top = base + blade.z2;
  // Row intervals are half-open: an exact top at 2100 belongs to row 30, not 31.
  return {
    bottom,
    top,
    firstRow: Math.floor(bottom / COURSE_MM + 1e-9) + 1,
    lastRow: Math.ceil(top / COURSE_MM - 1e-9)
  };
}
