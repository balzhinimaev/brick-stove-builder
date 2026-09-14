import { isMasonryPiece, masonryCategory } from "./masonryAudit";
import { brickPhysicalSolids, solidPolyhedron } from "./geometry/collisions";
import { polyhedronVolumeMm3 } from "./geometry/convex";
import type { BrickFootprint, MaterialsEstimate, Parameters, PlacedBrick } from "./types";

const CM_PER_M = 100;
/** Nominal density for a rough mass estimate; grade and inferred section thickness are not certified. */
const STEEL_KG_PER_MM3 = 7850 / 1e9;
export const isSteelPart = (brick: Pick<BrickFootprint, "kind" | "custom">): boolean =>
  brick.kind === "custom" && brick.custom?.material === "steel";

export function estimateMaterials(allBricks: PlacedBrick[], parameters: Parameters): MaterialsEstimate {
  let regularBricks = 0;
  let cutLike = 0;
  let fullPieces = 0,
    rectangularPieces = 0,
    shapedPieces = 0;
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
    if (isMasonryPiece(brick)) {
      const category = masonryCategory(brick);
      if (category === "full") fullPieces++;
      else if (category === "rectangular") rectangularPieces++;
      else shapedPieces++;
      if (brick.kind === "firebrick" || brick.custom?.cutFrom === "firebrick") firebricks++;
      else if (category === "full") regularBricks++;
      else if (brick.kind === "rebate") rebatedBricks++;
      else cutLike++;
      continue;
    }
    switch (brick.kind) {
      case "cleanout":
        doors++;
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

  const cutBricks = cutLike;
  // No per-fragment coefficient: unknown joint volume must not become a purchase quantity.
  const mortarM3 = fullPieces + rectangularPieces + shapedPieces > 0 ? null : 0;
  const concreteVolumeM3 =
    (parameters.foundationWidth / CM_PER_M) *
    (parameters.foundationLength / CM_PER_M) *
    (parameters.foundationThickness / CM_PER_M);

  return {
    fullPieces,
    rectangularPieces,
    shapedPieces,
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
