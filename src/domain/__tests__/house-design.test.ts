import { expect, it } from "vitest";
import {
  HOUSE_DESIGN,
  HOUSE_HEAT,
  heatDemand,
  houseMassAndFoundation,
  rhsCheck,
  stackBuoyancyPa
} from "../houseRussianDesign";
import { HOUSE_RUSSIAN_STOVE } from "../houseRussianStove";
import { brickPhysicalSolids, gridFromParameters, isInsideGrid, cloneRows } from "../geometry";

it("keeps the assumed building and actual solids consistent, with three full cap layers", () => {
  const stock = Object.values(HOUSE_RUSSIAN_STOVE.rows).flat();
  expect(stock.every((b) => isInsideGrid(b, gridFromParameters(HOUSE_RUSSIAN_STOVE.parameters)))).toBe(true);
  const top = (items: typeof stock) =>
    Math.max(...items.flatMap((b) => brickPhysicalSolids(b).map((s) => (b.row - 1) * 70 + s.z2)));
  const body = stock.filter((b) => b.x * 125 >= 625 && b.kind === "custom");
  expect(top(body)).toBe(HOUSE_DESIGN.bodyTopMm);
  expect(top(stock)).toBe(HOUSE_DESIGN.chimneyTopMm);
  expect(HOUSE_DESIGN.ceilingMm - top(body)).toBe(475);
  expect(HOUSE_DESIGN.shaftWidthMm + 2 * HOUSE_DESIGN.penetrationGapMm).toBe(1260);
  expect(HOUSE_DESIGN.shaftDepthMm + 2 * HOUSE_DESIGN.penetrationGapMm).toBe(1380);
  for (const r of [27, 28, 29]) {
    const cap = HOUSE_RUSSIAN_STOVE.rows[r].filter((b) => b.x * 125 >= 625);
    expect(cap.length).toBeGreaterThan(50);
    for (const b of cap) for (const s of brickPhysicalSolids(b)) expect(s.z2 - s.z1).toBeCloseTo(65);
  }
  for (const b of stock.filter(
    (b) =>
      b.kind === "custom" && b.custom?.profileXZ && b.custom.material !== "steel" && !b.custom.name.includes(" · клин")
  )) {
    const p = b.custom!.profileXZ!;
    const dims = [
      b.custom!.w * 125,
      b.custom!.h * 125,
      Math.max(...p.map((p) => p.z)) - Math.min(...p.map((p) => p.z))
    ].sort((a, b) => a - b);
    expect(dims[0], b.id).toBeLessThanOrEqual(65.00001);
    expect(dims[1], b.id).toBeLessThanOrEqual(120.00001);
    expect(dims[2], b.id).toBeLessThanOrEqual(250.00001);
  }
  for (const b of stock.filter((b) => b.kind === "custom" && !b.custom?.profileXZ)) {
    const dims = [b.custom!.w * 125, b.custom!.h * 125].sort((a, b) => a - b);
    expect(dims[0], b.id).toBeLessThanOrEqual(120.00001);
    expect(dims[1], b.id).toBeLessThanOrEqual(250.00001);
  }
});
it("calculates losses with units, explicit assumptions and no invented verified stove output", () => {
  expect(heatDemand({ wallU: 1, windowU: 1, doorU: 1, roofU: 1, floorU: 1, ach: 0 })).toEqual({
    transmissionWK: 183,
    ventilationWK: 0,
    lossKw: 9.15,
    designKw: 10.065000000000001
  });
  expect(HOUSE_DESIGN.constructionApproved).toBe(false);
  expect(HOUSE_DESIGN.verifiedOutputKw).toBeNull();
  expect(HOUSE_HEAT.proposed.designKw).toBeCloseTo(6.444625);
  expect(HOUSE_HEAT.uncertain.designKw).toBeGreaterThan(HOUSE_HEAT.proposed.designKw);
  expect(HOUSE_HEAT.weak.designKw).toBeGreaterThan(HOUSE_HEAT.uncertain.designKw);
  expect(stackBuoyancyPa(20, 20)).toBe(0);
  expect(stackBuoyancyPa(150, -30)).toBeGreaterThan(0);
  expect(stackBuoyancyPa(-30, 20)).toBeLessThan(0);
  // Classical simply supported beam, UDL: M = FL/8, delta = 5FL³/(384EI).
  const b = rhsCheck(100, 50, 5, 1000, 8);
  expect(b.modulus).toBeCloseTo((50 * 100 ** 3 - 40 * 90 ** 3) / 12 / 50);
  expect(b.stressMpa * b.modulus).toBeCloseTo(1000000);
});
it("estimates the complete rooted chimney and foundation, preserving the editable source", () => {
  const before = JSON.stringify(HOUSE_RUSSIAN_STOVE);
  const m = houseMassAndFoundation(HOUSE_RUSSIAN_STOVE);
  expect(m.foundationM3).toBeCloseTo(9.49);
  expect(m.modelKg).toBeGreaterThan(5000);
  expect(m.maxKpa).toBeLessThan(HOUSE_DESIGN.foundation.assumedBearingKpa);
  expect(m.minKpa).toBeGreaterThan(0);
  expect(m.minKpa + m.maxKpa).toBeCloseTo(m.averageKpa * 2);
  const copy = cloneRows(HOUSE_RUSSIAN_STOVE.rows);
  const b = Object.values(copy)
    .flat()
    .find((b) => b.custom?.profileXZ)!;
  b.custom!.profileXZ![0].z += 2;
  expect(JSON.stringify(HOUSE_RUSSIAN_STOVE)).toBe(before);
});
