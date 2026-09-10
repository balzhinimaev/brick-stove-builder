import { expect, it } from "vitest";
import { makeTeplushka15 } from "../teplushka15";
const model = makeTeplushka15();
it("transcribes the fixed upper hood envelope instead of misreading cheek dimensions as external widths", () => {
  for (let row = 25; row <= 32; row++) {
    const masonry = model.rows[row].filter((b) => b.kind === "custom" && b.custom?.material !== "steel");
    expect(Math.max(...masonry.map((b) => (b.x + b.custom!.w) * 125)) - 125).toBeCloseTo(890);
  }
});
it("retains source long rear headers and distinct dimensioned steel stock", () => {
  for (const row of [10, 11])
    for (const x of [260, 520, 780])
      expect(
        model.rows[row].some(
          (b) => Math.abs(b.x * 125 - 125 - x) < 1e-6 && b.y * 125 - 125 === 1040 && b.custom!.h * 125 === 250
        )
      ).toBe(true);
  const steel = Object.values(model.rows)
    .flat()
    .filter((b) => b.custom?.material === "steel");
  expect(steel).toHaveLength(7); // three two-solid angles and the source flat strip
  expect(steel.every((b) => b.kind === "custom" && !b.custom?.cutFrom)).toBe(true);
  for (const row of [10, 11])
    expect(
      model.rows[row].filter(
        (b) => b.y * 125 - 125 >= 900 - 1e-6 && b.y * 125 - 125 < 910 && b.custom!.h * 125 <= 10.01
      )
    ).toEqual([]);
});
