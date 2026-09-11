import { brickPhysicalSolids } from "../../geometry";
import type { PlacedBrick } from "../../types";
import { classicVolume } from "./classicVolume";

/** Fill only paired, parallel masonry faces separated by 0..5 mm. No blanket
 * dilation of a flue, casting clearance, steel pocket or external wall surface.
 * Inclined vault mortar is handled by the canonical arch audit. */
export function houseVolume(bricks: PlacedBrick[], removedIds: string[] = []) {
  const stock = bricks.filter((b) => !removedIds.includes(b.id));
  const boxes = stock.flatMap((b) => {
    if (b.kind !== "custom" || b.custom?.material === "steel") return [];
    const p = b.custom?.profileXZ;
    if (p && (p.length !== 4 || new Set(p.map((v) => v.x)).size !== 2 || new Set(p.map((v) => v.z)).size !== 2))
      return [];
    return brickPhysicalSolids(b).map((s) => ({
      id: b.id,
      lo: [s.box.x1 * 125, s.box.y1 * 125, (b.row - 1) * 70 + s.z1],
      hi: [s.box.x2 * 125, s.box.y2 * 125, (b.row - 1) * 70 + s.z2]
    }));
  });
  const fills: PlacedBrick[] = [];
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i],
        b = boxes[j];
      if (a.lo.some((lo, k) => Math.max(lo, b.lo[k]) - Math.min(a.hi[k], b.hi[k]) > 5.00001)) continue;
      for (let axis = 0; axis < 3; axis++) {
        const lo = a.lo.map((v, k) => Math.max(v, b.lo[k]));
        const hi = a.hi.map((v, k) => Math.min(v, b.hi[k]));
        const gap = lo[axis] - hi[axis];
        if (gap <= 0.00001 || gap > 5.00001 || lo.some((v, k) => k !== axis && hi[k] - v < 0.00001)) continue;
        [lo[axis], hi[axis]] = [hi[axis], lo[axis]];
        const row = Math.floor((lo[2] + 1e-6) / 70) + 1,
          base = (row - 1) * 70;
        const w = hi[0] - lo[0],
          h = hi[1] - lo[1];
        fills.push({
          id: `joint-${fills.length}`,
          row,
          kind: "custom",
          orientation: "h",
          x: lo[0] / 125,
          y: lo[1] / 125,
          custom: {
            name: "Audit-only paired mortar joint",
            w: w / 125,
            h: h / 125,
            profileXZ: [
              { x: 0, z: lo[2] - base },
              { x: w, z: lo[2] - base },
              { x: w, z: hi[2] - base },
              { x: 0, z: hi[2] - base }
            ]
          }
        });
      }
    }
  return classicVolume([...stock, ...fills]);
}
