import { describe, expect, it } from "vitest";
import { gridFromParameters, planPlacement, plateSeatZ, brickSolids } from "../geometry";
import { plateSpecFromMm } from "../editor";
import { DEFAULT_PARAMETERS } from "../constants";
import type { PlacedBrick } from "../types";

const grid = gridFromParameters(DEFAULT_PARAMETERS);

/** Кирпич с пазом вдоль южной грани (полка под плиту) на глубину depthMm. */
const rebate = (id: string, x: number, y: number, depthMm: number): PlacedBrick => ({
  id,
  row: 2,
  x,
  y,
  kind: "rebate",
  orientation: "h",
  notchCorner: "s",
  custom: { name: "", w: 2, h: 1, notch: null, notchDepthMm: depthMm }
});

const flushPlate = (id: string, x: number, y: number, wMm = 125, hMm = 125, t = 14): PlacedBrick => ({
  id,
  row: 2,
  x,
  y,
  kind: "plate",
  orientation: "h",
  custom: { ...plateSpecFromMm(wMm, hMm, t, true) }
});

describe("plateSeatZ — плита садится на самую высокую полку", () => {
  it("полка «под плиту» 14 мм → посадка 51, верх заподлицо с рядом", () => {
    const seat = plateSeatZ([rebate("r", 0, 0, 14)], flushPlate("p", 0.5, 0.5));
    expect(seat).toBe(51);
  });

  it("классическая четверть 32.5 → плита утоплена на полку 32.5", () => {
    const seat = plateSeatZ([rebate("r", 0, 0, 32.5)], flushPlate("p", 0.5, 0.5));
    expect(seat).toBe(32.5);
  });

  it("полки разной глубины → берётся самая высокая опора", () => {
    const seat = plateSeatZ(
      [rebate("a", 0, 0, 32.5), rebate("b", 0, 1, 14)],
      flushPlate("p", 0.5, 0.5, 125, 250)
    );
    expect(seat).toBe(51);
  });

  it("без полок → верх заподлицо (65 − толщина)", () => {
    expect(plateSeatZ([], flushPlate("p", 3, 3))).toBe(51);
    expect(plateSeatZ([], flushPlate("p", 3, 3, 125, 125, 20))).toBe(45);
  });
});

describe("planPlacement — посадка штампуется при установке", () => {
  it("flush-плита над глубокой полкой получает seatZMm и честные объёмы", () => {
    const rows = { 2: [rebate("r", 0, 0, 32.5)] };
    const plan = planPlacement(rows, 2, [flushPlate("p", 0.5, 0.5)], grid);
    expect(plan.rows).not.toBeNull();
    const placed = plan.rows![2].find((b) => b.kind === "plate")!;
    expect(placed.custom?.seatZMm).toBe(32.5);
    const solid = brickSolids(placed)[0];
    expect(solid.z1).toBe(32.5);
    expect(solid.z2).toBe(46.5);
  });

  it("кирпич следующего ряда ложится над утопленной плитой", () => {
    const rows = { 2: [rebate("r", 0, 0, 32.5)] };
    const withPlate = planPlacement(rows, 2, [flushPlate("p", 0.5, 0.5)], grid).rows!;
    const above: PlacedBrick = { id: "up", row: 3, x: 0, y: 0, kind: "standard", orientation: "h" };
    const plan = planPlacement(withPlate, 3, [above], grid);
    expect(plan.rows).not.toBeNull();
  });
});

describe("planPlacement — клик плитой по плите = замена (пересадка)", () => {
  it("«поверх» → «в вырезы»: плита заменяется, а не дублируется", () => {
    const onTop: PlacedBrick = { ...flushPlate("p1", 1, 1), custom: { ...plateSpecFromMm(125, 125, 14, false) } };
    const rows = planPlacement({ 2: [] }, 2, [onTop], grid).rows!;
    const plan = planPlacement(rows, 2, [flushPlate("p2", 1, 1)], grid);
    expect(plan.rows).not.toBeNull();
    const plates = plan.rows![2].filter((b) => b.kind === "plate");
    expect(plates).toHaveLength(1);
    expect(plates[0].id).toBe("p2");
    expect(plates[0].custom?.flush).toBe(true);
  });

  it("замена отклоняется, если новой плите мешает не-плита", () => {
    const wall: PlacedBrick = { id: "w", row: 2, x: 1, y: 1, kind: "standard", orientation: "h" };
    const onTop: PlacedBrick = { ...flushPlate("p1", 3, 1), custom: { ...plateSpecFromMm(250, 125, 14, false) } };
    const rows = planPlacement({ 2: [wall] }, 2, [onTop], grid).rows!;
    // новая flush-плита 3×1 накрывает и старую плиту, и целый кирпич → отказ с виновником-кирпичом
    const big = { ...flushPlate("p2", 1, 1, 500, 125), id: "p2" };
    const plan = planPlacement(rows, 2, [big], grid);
    expect(plan.rows).toBeNull();
    expect(plan.conflicts.map((b) => b.id)).toContain("w");
  });
});
