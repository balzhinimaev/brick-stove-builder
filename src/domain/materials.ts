import { brickPhysicalSolids, solidPolyhedron } from "./geometry/collisions";
import { polyhedronVolumeMm3 } from "./geometry/convex";
import type { BrickFootprint, MaterialsEstimate, Parameters, PlacedBrick } from "./types";

/** Mortar volume per full brick joint, m³ (rough demo coefficient). */
const MORTAR_M3_PER_BRICK = 0.0016;
/** Two `trim` quarter-cuts count as a single cut brick in the tally. */
const TRIM_AS_CUT_FACTOR = 0.5;
/** A cut brick consumes roughly half the mortar of a full brick. */
const CUT_MORTAR_FACTOR = 0.5;
const CM_PER_M = 100;
/** Nominal density for a rough mass estimate; grade and inferred section thickness are not certified. */
const STEEL_KG_PER_MM3 = 7850 / 1e9;
export const isSteelPart = (brick: Pick<BrickFootprint, "kind" | "custom">): boolean =>
  brick.kind === "custom" && brick.custom?.material === "steel";

export function estimateMaterials(allBricks: PlacedBrick[], parameters: Parameters): MaterialsEstimate {
  let regularBricks = 0;
  let cutLike = 0;
  let trims = 0;
  let rebatedBricks = 0;
  let firebricks = 0;
  let grates = 0;
  let plates = 0;
  let doors = 0;
  let dampers = 0;
  let vents = 0;
  let steelPieces = 0;
  let steelKg = 0;

  for (const brick of allBricks) {
    if (isSteelPart(brick)) {
      steelPieces++;
      steelKg +=
        brickPhysicalSolids(brick).reduce((volume, solid) => volume + polyhedronVolumeMm3(solidPolyhedron(solid)), 0) *
        STEEL_KG_PER_MM3;
      continue;
    }
    switch (brick.kind) {
      case "standard":
        regularBricks++;
        break;
      case "rebate":
        rebatedBricks++;
        break;
      case "cut":
        cutLike++;
        break;
      case "custom":
        // автоподрез из шамота — по-прежнему шамот в смете
        if (brick.custom?.cutFrom === "firebrick") firebricks++;
        else cutLike++;
        break;
      case "cleanout":
        doors++;
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
      case "plate":
        plates++;
        break;
      case "damper":
        dampers++;
        break;
      case "vent":
        // Вентканал — размеченная пустота: кирпича и раствора не расходует,
        // но в смете виден отдельной строкой, чтобы сходился общий счёт.
        vents++;
        break;
    }
  }

  const cutBricks = cutLike + trims * TRIM_AS_CUT_FACTOR;
  // Кирпич с четвертью — целый кирпич минус четверть: и по расходу раствора близок к целому.
  const mortarM3 =
    (regularBricks + rebatedBricks * 0.75 + firebricks + cutBricks * CUT_MORTAR_FACTOR) * MORTAR_M3_PER_BRICK;
  const concreteVolumeM3 =
    (parameters.foundationWidth / CM_PER_M) *
    (parameters.foundationLength / CM_PER_M) *
    (parameters.foundationThickness / CM_PER_M);

  return {
    regularBricks,
    cutBricks,
    rebatedBricks,
    firebricks,
    grates,
    plates,
    doors,
    dampers,
    vents,
    steelPieces,
    steelKg,
    mortarM3,
    concreteVolumeM3,
    total: allBricks.length
  };
}
