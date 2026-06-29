import type { MaterialsEstimate, Parameters, PlacedBrick } from "./types";

/** Mortar volume per full brick joint, m³ (rough demo coefficient). */
const MORTAR_M3_PER_BRICK = 0.0016;
/** Two `trim` quarter-cuts count as a single cut brick in the tally. */
const TRIM_AS_CUT_FACTOR = 0.5;
/** A cut brick consumes roughly half the mortar of a full brick. */
const CUT_MORTAR_FACTOR = 0.5;
const CM_PER_M = 100;

export function estimateMaterials(allBricks: PlacedBrick[], parameters: Parameters): MaterialsEstimate {
  let regularBricks = 0;
  let cutLike = 0;
  let trims = 0;
  let firebricks = 0;
  let grates = 0;

  for (const brick of allBricks) {
    switch (brick.kind) {
      case "standard":
        regularBricks++;
        break;
      case "cut":
      case "cleanout":
        cutLike++;
        break;
      case "trim":
        trims++;
        break;
      case "firebrick":
        firebricks++;
        break;
      case "grate":
        grates++;
        break;
    }
  }

  const cutBricks = cutLike + trims * TRIM_AS_CUT_FACTOR;
  const mortarM3 = (regularBricks + firebricks + cutBricks * CUT_MORTAR_FACTOR) * MORTAR_M3_PER_BRICK;
  const concreteVolumeM3 =
    (parameters.foundationWidth / CM_PER_M) *
    (parameters.foundationLength / CM_PER_M) *
    (parameters.foundationThickness / CM_PER_M);

  return { regularBricks, cutBricks, firebricks, grates, mortarM3, concreteVolumeM3, total: allBricks.length };
}
