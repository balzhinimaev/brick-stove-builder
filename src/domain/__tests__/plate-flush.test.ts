import { describe, expect, it } from "vitest";
import { buildPlacementDrafts, DEFAULT_REBATE_DEPTH_MM, initialEditorState, type PlacementSelection } from "../editor";
import { brickSolids, gridFromParameters, planPlacement } from "../geometry";
import { DEFAULT_PARAMETERS } from "../constants";
import type { CustomBrickSpec, NotchCorner, PlacedBrick } from "../types";

const grid = gridFromParameters(DEFAULT_PARAMETERS);

/** Кирпич с пазом вдоль грани; глубина реза по высоте — в мм (спека h-ориентации). */
const seatBrick = (id: string, x: number, y: number, corner: NotchCorner, depthMm: number, row = 3): PlacedBrick => ({
  id,
  row,
  x,
  y,
  kind: "rebate",
  orientation: "h",
  notchCorner: corner,
  custom: { name: "", w: 2, h: 1, notch: null, notchDepthMm: depthMm }
});

const flushPlate = (id: string, x: number, y: number, wCells: number, hCells: number, thicknessMm: number, row = 3): PlacedBrick => ({
  id,
  row,
  x,
  y,
  kind: "plate",
  orientation: "h",
  custom: { name: "", w: wCells, h: hCells, notch: null, thicknessMm, flush: true }
});

describe("плита заподлицо в вырезы кирпичей", () => {
  // посадочное гнездо: два кирпича пазами навстречу, между ними просвет 1 ячейка;
  // плита 2×1 краями входит в оба паза по 0.5 ячейки
  const seat = (depthMm: number) => [
    seatBrick("west", 0, 1, "e", depthMm),
    seatBrick("east", 3, 1, "w", depthMm)
  ];

  it("ложится, когда вырез глубиной ровно в толщину плиты (плита ЛЕЖИТ на полке)", () => {
    const rows = { 3: seat(14) };
    const plan = planPlacement(rows, 3, [flushPlate("p", 1.5, 1, 2, 1, 14)], grid);
    expect(plan.rows).not.toBeNull();

    // низ плиты совпадает с верхом полки — контакт без зазора и без пересечения
    const ledgeTop = Math.max(...brickSolids(seat(14)[0]).map((solid) => solid.z2 !== 65 ? solid.z2 : 0));
    const plateBottom = brickSolids(flushPlate("p", 1.5, 1, 2, 1, 14))[0].z1;
    expect(plateBottom).toBe(51);
    expect(ledgeTop).toBe(51);
  });

  it("ложится и в более глубокий вырез (полка ниже плиты)", () => {
    const plan = planPlacement({ 3: seat(DEFAULT_REBATE_DEPTH_MM) }, 3, [flushPlate("p", 1.5, 1, 2, 1, 14)], grid);
    expect(plan.rows).not.toBeNull();
  });

  it("вырез МЕЛЬЧЕ толщины плиты: плита садится на полку и выступает над рядом", () => {
    const rows = { 3: seat(10) }; // полка на 55 мм — низ плиты 55, верх 69 (торчит над рядом)
    const plan = planPlacement(rows, 3, [flushPlate("p", 1.5, 1, 2, 1, 14)], grid);
    expect(plan.rows).not.toBeNull();
    const placed = plan.rows![3].find((b) => b.kind === "plate")!;
    expect(placed.custom?.seatZMm).toBe(55);
  });

  it("отклоняется, когда край плиты заходит за паз в тело кирпича", () => {
    const rows = { 3: seat(14) };
    // сдвиг влево на полячейки: левый край в теле кирпича west (за пазом)
    const plan = planPlacement(rows, 3, [flushPlate("p", 1, 1, 2, 1, 14)], grid);
    expect(plan.rows).toBeNull();
    expect(plan.conflicts.map((brick) => brick.id)).toEqual(["west"]);
  });

  it("отклоняется над полнотелым кирпичом в центре и не заменяет его молча", () => {
    const middle: PlacedBrick = { id: "mid", row: 3, x: 1.5, y: 1, kind: "standard", orientation: "h" };
    const plan = planPlacement({ 3: [...seat(14), middle] }, 3, [flushPlate("p", 1.5, 1, 2, 1, 14)], grid);
    expect(plan.rows).toBeNull();
    expect(plan.conflicts.map((brick) => brick.id)).toContain("mid");
  });

  it("накладная плита (не заподлицо) ложится ПОВЕРХ того же гнезда без конфликтов", () => {
    const onTop: PlacedBrick = { ...flushPlate("p", 1.5, 1, 2, 1, 14), custom: { name: "", w: 2, h: 1, notch: null, thicknessMm: 14, flush: false } };
    const plan = planPlacement({ 3: seat(10) }, 3, [onTop], grid);
    expect(plan.rows).not.toBeNull();
  });
});

describe("buildPlacementDrafts — превью и установка видят одну геометрию", () => {
  const selection = (over: Partial<PlacementSelection>): PlacementSelection => ({
    currentRow: 2,
    activeTool: "standard",
    orientation: "h",
    notchCorner: "ne",
    rebateDepthMm: DEFAULT_REBATE_DEPTH_MM,
    customBrick: null,
    plateSpec: initialEditorState().plateSpec,
    doorSpec: initialEditorState().doorSpec,
    damperSpec: initialEditorState().damperSpec,
    ...over
  });

  it("четверть уносит выбранную глубину реза на элемент (спека в h-ориентации)", () => {
    const drafts = buildPlacementDrafts(selection({ activeTool: "rebate", orientation: "v", rebateDepthMm: 15 }), 1, 1, () => 0);
    expect(drafts).toHaveLength(1);
    expect(drafts![0].custom).toMatchObject({ w: 2, h: 1, notchDepthMm: 15 });
    expect(drafts![0].notchCorner).toBe("ne");
  });

  it("ластик и резак без выбранной формы ничего не ставят", () => {
    expect(buildPlacementDrafts(selection({ activeTool: "eraser" }), 1, 1, () => 0)).toBeNull();
    expect(buildPlacementDrafts(selection({ activeTool: "custom", customBrick: null }), 1, 1, () => 0)).toBeNull();
  });

  it("колосник ставится сборкой из решётки и четырёх подрезок", () => {
    const drafts = buildPlacementDrafts(selection({ activeTool: "grate" }), 2, 2, (() => { let i = 0; return () => i++; })());
    expect(drafts).toHaveLength(5);
    expect(drafts!.map((brick) => brick.kind).sort()).toEqual(["grate", "trim", "trim", "trim", "trim"]);
  });

  it("плита берёт текущую спеку размера/толщины/посадки", () => {
    const spec: CustomBrickSpec = { name: "Плита", w: 3, h: 2, notch: null, thicknessMm: 20, flush: true };
    const drafts = buildPlacementDrafts(selection({ activeTool: "plate", plateSpec: spec }), 1, 1, () => 0);
    expect(drafts![0].custom).toBe(spec);
  });
});
