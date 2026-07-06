import { describe, expect, it } from "vitest";
import { cutBrickForPlate, gridFromParameters, planPlacement, plateSeatZ, brickSolids } from "../geometry";
import { grateSpecFromMm, plateSpecFromMm } from "../editor";
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

describe("plateSeatZ — опора есть → заподлицо, опоры нет → низ ряда", () => {
  it("полка «под плиту» 14 мм → посадка 51, верх заподлицо с рядом", () => {
    const seat = plateSeatZ([rebate("r", 0, 0, 14)], flushPlate("p", 0.5, 0.5));
    expect(seat).toBe(51);
  });

  it("глубокая четверть 32.5 — всё равно 51: пере-рез при установке выровняет полку", () => {
    const seat = plateSeatZ([rebate("r", 0, 0, 32.5)], flushPlate("p", 0.5, 0.5));
    expect(seat).toBe(51);
  });

  it("полки разной глубины → посадка одна, заподлицо (65 − t)", () => {
    const seat = plateSeatZ(
      [rebate("a", 0, 0, 32.5), rebate("b", 0, 1, 14)],
      flushPlate("p", 0.5, 0.5, 125, 250)
    );
    expect(seat).toBe(51);
  });

  it("под следом ПУСТО → 0: элемент ложится на низ ряда, а не висит в воздухе", () => {
    expect(plateSeatZ([], flushPlate("p", 3, 3))).toBe(0);
    expect(plateSeatZ([], flushPlate("p", 3, 3, 125, 125, 20))).toBe(0);
  });

  it("накладные и другой колосник — не опора", () => {
    const damper: PlacedBrick = { id: "d", row: 2, x: 3, y: 3, kind: "damper", orientation: "h", custom: { name: "", w: 2, h: 1, notch: null, thicknessMm: 20 } };
    expect(plateSeatZ([damper], flushPlate("p", 3, 3))).toBe(0);
  });
});

describe("planPlacement — посадка штампуется при установке", () => {
  it("flush-плита над глубокой полкой: полка пере-резается под толщину, плита заподлицо", () => {
    const rows = { 2: [rebate("r", 0, 0, 32.5)] };
    const plan = planPlacement(rows, 2, [flushPlate("p", 0.5, 0.5)], grid);
    expect(plan.rows).not.toBeNull();
    // глубокая четверть выровнена на толщину плиты — верх плиты вровень с рядом
    expect(plan.rows![2].find((b) => b.id === "r")?.custom?.notchDepthMm).toBe(14);
    const placed = plan.rows![2].find((b) => b.kind === "plate")!;
    expect(placed.custom?.seatZMm).toBe(51);
    const solid = brickSolids(placed)[0];
    expect(solid.z1).toBe(51);
    expect(solid.z2).toBe(65);
  });

  it("кирпич следующего ряда ложится над плитой заподлицо", () => {
    const rows = { 2: [rebate("r", 0, 0, 32.5)] };
    const withPlate = planPlacement(rows, 2, [flushPlate("p", 0.5, 0.5)], grid).rows!;
    const above: PlacedBrick = { id: "up", row: 3, x: 0, y: 0, kind: "standard", orientation: "h" };
    const plan = planPlacement(withPlate, 3, [above], grid);
    expect(plan.rows).not.toBeNull();
  });
});

describe("автоподрез кирпичей под flush-плиту", () => {
  const std = (id: string, x: number, y: number): PlacedBrick => ({
    id, row: 2, x, y, kind: "standard", orientation: "h"
  });

  it("плита на целых кирпичах: кирпичи подрезаются полкой в её толщину, плита заподлицо", () => {
    // плита 410×340 (3.28×2.72) при (1,1) поверх двух целых кирпичей
    const rows = { 2: [std("a", 1, 1), std("b", 1, 2)] };
    const plate = flushPlate("p", 1, 1, 410, 340);
    const before = JSON.stringify(rows);
    const plan = planPlacement(rows, 2, [plate], grid);
    expect(plan.rows).not.toBeNull();
    expect(JSON.stringify(rows)).toBe(before); // входные rows не мутированы (undo честный)

    const placed = plan.rows![2].find((b) => b.kind === "plate")!;
    expect(placed.custom?.seatZMm).toBe(51); // полка 65 − 14

    const cutA = plan.rows![2].find((b) => b.id === "a")!;
    expect(cutA.kind).toBe("custom");
    expect(cutA.custom?.notchDepthMm).toBe(14);
    expect(cutA.custom?.name).toBe("Подрез под плиту");
    // кирпич «a» 2×1 при (1,1) целиком в следе плиты → срез по всему верху
    expect(cutA.custom?.notch).toEqual({ x1: 0, y1: 0, x2: 2, y2: 1 });
  });

  it("частичное перекрытие: вырез только в зоне следа, заякорен в грань", () => {
    // кирпич при (0,1), плита начинается с x=1 → срезается восточная часть
    const rows = { 2: [std("a", 0, 1)] };
    const plan = planPlacement(rows, 2, [flushPlate("p", 1, 1, 410, 340)], grid);
    expect(plan.rows).not.toBeNull();
    const cut = plan.rows![2].find((b) => b.id === "a")!;
    expect(cut.custom?.notch).toEqual({ x1: 1, y1: 0, x2: 2, y2: 1 });
  });

  it("мелкая полка углубляется до толщины плиты", () => {
    const shallow = rebate("r", 0, 0, 8); // полка на 57 — выше, чем нужно плите 14
    const plan = planPlacement({ 2: [shallow] }, 2, [flushPlate("p", 0.5, 0.5)], grid);
    expect(plan.rows).not.toBeNull();
    const deepened = plan.rows![2].find((b) => b.id === "r")!;
    expect(deepened.custom?.notchDepthMm).toBe(14);
    expect(plan.rows![2].find((b) => b.kind === "plate")!.custom?.seatZMm).toBe(51);
  });

  it("нережимое под плитой (дверца) — честный отказ с виновником", () => {
    const door: PlacedBrick = {
      id: "door", row: 2, x: 1, y: 1, kind: "cleanout", orientation: "h",
      custom: { name: "Дверца", w: 2, h: 1, notch: null, heightMm: 210 }
    };
    const plan = planPlacement({ 2: [door] }, 2, [flushPlate("p", 1, 1, 410, 340)], grid);
    expect(plan.rows).toBeNull();
    expect(plan.conflicts.map((b) => b.id)).toContain("door");
  });

  it("cutBrickForPlate: кирпич вне следа возвращается как есть", () => {
    const far = std("far", 7, 7);
    expect(cutBrickForPlate(far, flushPlate("p", 1, 1), 14)).toBe(far);
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

  it("замена отклоняется, если новой плите мешает нережимое (дверца)", () => {
    const door: PlacedBrick = {
      id: "door", row: 2, x: 1, y: 1, kind: "cleanout", orientation: "h",
      custom: { name: "Дверца", w: 2, h: 1, notch: null, heightMm: 210 }
    };
    const onTop: PlacedBrick = { ...flushPlate("p1", 3, 1), custom: { ...plateSpecFromMm(250, 125, 14, false) } };
    const rows = planPlacement({ 2: [door] }, 2, [onTop], grid).rows!;
    // новая flush-плита 3×1 накрывает и старую плиту, и дверцу → отказ с виновником-дверцей
    const big = { ...flushPlate("p2", 1, 1, 500, 125), id: "p2" };
    const plan = planPlacement(rows, 2, [big], grid);
    expect(plan.rows).toBeNull();
    expect(plan.conflicts.map((b) => b.id)).toContain("door");
  });
});

describe("колосник садится в вырезы, как плита", () => {
  const grate = (id: string, x: number, y: number, l = 375, w = 250, t = 22): PlacedBrick => ({
    id, row: 2, x, y, kind: "grate", orientation: "h",
    custom: { ...grateSpecFromMm(l, w, t) }
  });

  it("колосник на целых кирпичах: автоподрез на 22 мм, верх заподлицо", () => {
    const bricks: PlacedBrick[] = [
      { id: "a", row: 2, x: 1, y: 1, kind: "standard", orientation: "h" },
      { id: "b", row: 2, x: 1, y: 2, kind: "standard", orientation: "h" }
    ];
    const plan = planPlacement({ 2: bricks }, 2, [grate("g", 1, 1)], grid);
    expect(plan.rows).not.toBeNull();
    const placed = plan.rows![2].find((b) => b.kind === "grate")!;
    expect(placed.custom?.seatZMm).toBe(43); // 65 − 22
    const solid = brickSolids(placed)[0];
    expect(solid.z1).toBe(43);
    expect(solid.z2).toBe(65);
    const cut = plan.rows![2].find((b) => b.id === "a")!;
    expect(cut.kind).toBe("custom");
    expect(cut.custom?.notchDepthMm).toBe(22);
  });

  it("plateSeatZ колосника: опора есть → 43 (65 − 22), пусто → 0", () => {
    expect(plateSeatZ([rebate("r", 1, 1, 32.5)], grate("g", 1.5, 1, 250, 125))).toBe(43);
    expect(plateSeatZ([], grate("g", 1.5, 1, 250, 125))).toBe(0);
  });

  it("колосник в пустоту: ложится на низ ряда (z 0..22), не висит в воздухе", () => {
    const plan = planPlacement({ 2: [] }, 2, [grate("g", 3, 3)], grid);
    expect(plan.rows).not.toBeNull();
    const placed = plan.rows![2].find((b) => b.kind === "grate")!;
    expect(placed.custom?.seatZMm).toBe(0);
    const solid = brickSolids(placed)[0];
    expect(solid.z1).toBe(0);
    expect(solid.z2).toBe(22);
  });

  it("колосник в готовые четверти 32.5: полки пере-резаются на 22 — верх заподлицо", () => {
    // гнездо: кирпичи пазами навстречу, колосник 250×125 краями в пазах
    const seatBricks: PlacedBrick[] = [
      { ...rebate("w1", 1, 1, 32.5), notchCorner: "e" },
      { ...rebate("e1", 3, 1, 32.5), notchCorner: "w" }
    ];
    const plan = planPlacement({ 2: seatBricks }, 2, [grate("g", 2.5, 1, 250, 125)], grid);
    expect(plan.rows).not.toBeNull();
    for (const id of ["w1", "e1"]) {
      expect(plan.rows![2].find((b) => b.id === id)?.custom?.notchDepthMm).toBe(22);
    }
    const placed = plan.rows![2].find((b) => b.kind === "grate")!;
    expect(placed.custom?.seatZMm).toBe(43);
    const solid = brickSolids(placed)[0];
    expect(solid.z2).toBe(65); // заподлицо с верхом ряда
  });

  it("колосник заходит за паз в тело кирпича — вырез расширяется, не отказ", () => {
    // паз 'e' в полячейки, колосник 375×250 накрывает восточную ПОЛОВИНУ кирпича
    const bricks: PlacedBrick[] = [
      { ...rebate("left", 0, 1, 32.5), notchCorner: "e" },
      { ...rebate("left2", 0, 2, 32.5), notchCorner: "e" }
    ];
    const plan = planPlacement({ 2: bricks }, 2, [grate("g", 1, 1)], grid);
    expect(plan.rows).not.toBeNull();
    const cut = plan.rows![2].find((b) => b.id === "left")!;
    expect(cut.kind).toBe("custom");
    // объединение старого паза (1.5..2) с зоной следа (1..2) → вырез 1..2, глубина 22
    expect(cut.custom?.notch).toEqual({ x1: 1, y1: 0, x2: 2, y2: 1 });
    expect(cut.custom?.notchDepthMm).toBe(22);
    const placed = plan.rows![2].find((b) => b.kind === "grate")!;
    expect(placed.custom?.seatZMm).toBe(43);
  });

  it("клик колосником по колоснику — замена (смена размера)", () => {
    const rows = planPlacement({ 2: [] }, 2, [grate("g1", 1, 1)], grid).rows!;
    const plan = planPlacement(rows, 2, [grate("g2", 1, 1, 250, 250)], grid);
    expect(plan.rows).not.toBeNull();
    const grates = plan.rows![2].filter((b) => b.kind === "grate");
    expect(grates).toHaveLength(1);
    expect(grates[0].id).toBe("g2");
  });

  it("колосник не подрезается плитой (нережимое)", () => {
    const rows = planPlacement({ 2: [] }, 2, [grate("g", 1, 1)], grid).rows!;
    const plan = planPlacement(rows, 2, [flushPlate("p", 1, 1, 410, 340)], grid);
    expect(plan.rows).toBeNull();
    expect(plan.conflicts.map((b) => b.id)).toContain("g");
  });
});

describe("глубокая проверка: найденные недочёты", () => {
  it("шамот под плитой остаётся шамотом: cutFrom + смета", async () => {
    const { estimateMaterials } = await import("../materials");
    const { DEFAULT_PARAMETERS } = await import("../constants");
    const fire: PlacedBrick = { id: "f", row: 2, x: 1, y: 1, kind: "firebrick", orientation: "h" };
    const plan = planPlacement({ 2: [fire] }, 2, [flushPlate("p", 1, 1, 410, 340)], grid);
    expect(plan.rows).not.toBeNull();
    const cut = plan.rows![2].find((b) => b.id === "f")!;
    expect(cut.custom?.cutFrom).toBe("firebrick");
    const est = estimateMaterials(plan.rows![2], DEFAULT_PARAMETERS);
    expect(est.firebricks).toBe(1); // не превратился в «резаный»
    expect(est.cutBricks).toBe(0);
  });

  it("тап обычным кирпичом по полностью срезанному — замена, а не наслоение", () => {
    const rows = planPlacement(
      { 2: [{ id: "a", row: 2, x: 1, y: 1, kind: "standard", orientation: "h" } as PlacedBrick] },
      2,
      [flushPlate("p", 1, 1, 410, 340)],
      grid
    ).rows!;
    // плиту сняли, кладём целый кирпич на место полностью срезанного «a»
    const withoutPlate = { 2: rows[2].filter((b) => b.kind !== "plate") };
    const tap: PlacedBrick = { id: "new", row: 2, x: 1, y: 1, kind: "standard", orientation: "h" };
    const plan = planPlacement(withoutPlate, 2, [tap], grid);
    expect(plan.rows).not.toBeNull();
    const atCell = plan.rows![2].filter((b) => b.x === 1 && b.y === 1);
    expect(atCell.map((b) => b.id)).toEqual(["new"]); // старый подрез заменён, дубля нет
  });

  it("copyRow не затирает ряд с колосником молча", async () => {
    const { editorReducer, initialEditorState } = await import("../editor");
    let state = { ...initialEditorState(), currentRow: 2, rows: { 2: [
      { id: "g", row: 2, x: 1, y: 1, kind: "grate", orientation: "h" } as PlacedBrick
    ] } };
    const next = editorReducer(state, { type: "copyRow", bricks: [
      { id: "c", row: 2, x: 5, y: 5, kind: "standard", orientation: "h" } as PlacedBrick
    ] });
    expect(next).toBe(state); // отказ: сначала ластик
  });
});
