import type { PlacedBrick } from "../../domain/types";

export type TeplushkaMode = "winter" | "summer" | "ventilation";
export type TeplushkaSection = "whole" | "front" | "side";
export type TeplushkaDamperIds = Record<"summer" | "main" | "hood" | "mouth", string>;
export type TeplushkaInspection = {
  section: TeplushkaSection;
  fraction: number;
  courseOnly?: boolean;
  coordinateMm?: number;
};
export const TEPLUSHKA_MODES: TeplushkaMode[] = ["winter", "summer", "ventilation"];

const SETTINGS: Record<TeplushkaMode, Record<keyof TeplushkaDamperIds, number>> = {
  winter: { main: 1, summer: 0, hood: 0, mouth: 0 },
  summer: { main: 1, summer: 1, hood: 0, mouth: 0 },
  ventilation: { main: 0, summer: 0, hood: 1, mouth: 1 }
};

/** Change stored blade states, never reset the example or erase edits. */
export function teplushkaModeOpenings(mode: TeplushkaMode, ids: TeplushkaDamperIds): Record<string, number> {
  return Object.fromEntries(Object.entries(ids).map(([role, id]) => [id, SETTINGS[mode][role as keyof typeof ids]]));
}

export function inspectTeplushkaMode(rows: Record<number, PlacedBrick[]>, ids: TeplushkaDamperIds) {
  const bricks = Object.values(rows).flat();
  const gates = Object.fromEntries(
    Object.entries(ids).map(([role, id]) => [role, bricks.find((brick) => brick.id === id && brick.kind === "damper")])
  ) as Record<keyof TeplushkaDamperIds, PlacedBrick | undefined>;
  const complete = Object.values(gates).every(Boolean);
  const mode = complete
    ? (TEPLUSHKA_MODES.find((candidate) =>
        Object.entries(gates).every(
          ([role, brick]) => (brick?.damperOpen ?? 0) === SETTINGS[candidate][role as keyof typeof ids]
        )
      ) ?? null)
    : null;
  return { complete, mode, gates };
}
