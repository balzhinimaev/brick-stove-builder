import { expect, it } from "vitest";
import { makeTeplushka15 } from "../teplushka15";
import { TEPLUSHKA_DAMPERS } from "../teplushkaControls";
import { brickPhysicalSolids, solidsIntersect3D, damperAperture } from "../geometry";
it("preserves source clear apertures and collision-free actual frame/blade travel at closed, half and full opening", () => {
  const bricks = Object.values(makeTeplushka15().rows).flat();
  const sizes = { summer: [130, 130], main: [140, 260], hood: [260, 260], mouth: [350, 280] };
  for (const [name, id] of Object.entries(TEPLUSHKA_DAMPERS)) {
    const gate = bricks.find((b) => b.id === id)!;
    for (const open of [0, 0.5, 1]) {
      const moving = { ...gate, damperOpen: open };
      const a = damperAperture(moving);
      expect([a.widthMm, a.heightMm]).toEqual(sizes[name as keyof typeof sizes]);
      expect(a.openAreaMm2).toBeCloseTo(a.fullAreaMm2 * open);
      for (const s of brickPhysicalSolids(moving))
        for (const b of bricks) {
          if (b.id === id) continue;
          for (const other of brickPhysicalSolids(b))
            expect(solidsIntersect3D(s, other, (gate.row - b.row) * 70), `${id}@${open}/${b.id}`).toBe(false);
        }
    }
  }
}, 30000);
