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

it("keeps source course-specific cheeks, the course4 opening and a whole summer shoulder cut", () => {
  const occupied = (row: number, x: number, y: number) =>
    model.rows[row].some((b) => {
      if (b.kind !== "custom" || b.custom?.material === "steel") return false;
      const left = b.x * 125 - 125,
        front = b.y * 125 - 125;
      return x > left && x < left + b.custom!.w * 125 && y > front && y < front + b.custom!.h * 125;
    });
  // Fig.33: open front-right course4, NOT a premature masonry lintel.
  expect(occupied(4, 970, 60)).toBe(false);
  // Dimensioned right cheeks: 20cm in r18, 30cm in r20, 38cm in r21.
  for (const [row, edge] of [
    [18, 1090],
    [20, 990],
    [21, 910]
  ]) {
    expect(occupied(row, edge - 1, 200)).toBe(false);
    expect(occupied(row, edge + 1, 200)).toBe(true);
  }
  // The parent-reported 2.5mm stub at x437.5..440 must be part of the
  // full 85x100 shoulder, not a separately emitted masonry element.
  const shoulder = model.rows[12].filter((b) => {
    const x = b.x * 125 - 125,
      y = b.y * 125 - 125;
    return x < 439 && x + b.custom!.w * 125 > 439 && y < 390 && y + b.custom!.h * 125 > 390;
  });
  expect(shoulder).toHaveLength(1);
  expect(shoulder[0].custom!.w * 125).toBeCloseTo(85);
  expect(shoulder[0].custom!.h * 125).toBeCloseTo(100);
  // Fig.33 27..32 dimensions are interior right cheek thicknesses.
  for (const [row, cheek] of [
    [27, 240],
    [28, 310],
    [29, 370],
    [30, 440],
    [31, 500],
    [32, 500]
  ]) {
    expect(occupied(row, 890 - cheek - 1, 200)).toBe(false);
    expect(occupied(row, 890 - cheek + 1, 200)).toBe(true);
  }
});
