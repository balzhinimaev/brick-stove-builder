import { describe, expect, it } from "vitest";
import {
  DEFAULT_DAMPER,
  buildPlacementDrafts,
  damperSpecFromMm,
  editorReducer,
  initialEditorState,
  type PlacementSelection
} from "../editor";
import { damperBlockers, gridFromParameters, isOverlayBrick, overlaps3D, placeBricksInRows } from "../geometry";
import { estimateMaterials } from "../materials";
import { DEFAULT_PARAMETERS } from "../constants";
import type { PlacedBrick } from "../types";

const grid = gridFromParameters(DEFAULT_PARAMETERS);

const selection = (row = 2): PlacementSelection => ({
  ...initialEditorState(),
  currentRow: row,
  activeTool: "damper"
});

const draftAt = (x: number, y: number, row = 2): PlacedBrick => {
  const drafts = buildPlacementDrafts(selection(row), x, y, () => 1);
  expect(drafts).not.toBeNull();
  return drafts![0];
};

describe("спека задвижки", () => {
  it("мм → ячейки: проём 250×130 = 2×1", () => {
    expect(DEFAULT_DAMPER.w).toBe(2);
    expect(DEFAULT_DAMPER.h).toBeCloseTo(1.04, 2);
    const square = damperSpecFromMm(125, 125);
    expect(square.w).toBe(1);
    expect(square.h).toBe(1);
  });

  it("черновик несёт спеку и закрыт по умолчанию", () => {
    const brick = draftAt(2, 2);
    expect(brick.kind).toBe("damper");
    expect(brick.custom?.name).toContain("Задвижка");
    expect(brick.damperOpen).toBe(0);
  });
});

describe("размещение: накладная в шве", () => {
  it("не конфликтует с кладкой своего и следующего ряда", () => {
    const wall: PlacedBrick = { id: "wall", row: 2, x: 2, y: 2, kind: "standard", orientation: "h" };
    const above: PlacedBrick = { id: "above", row: 3, x: 2, y: 2, kind: "standard", orientation: "h" };
    const damper = draftAt(2, 2);
    expect(isOverlayBrick(damper)).toBe(true);
    expect(overlaps3D(damper, wall)).toBe(false);
    expect(overlaps3D(damper, above)).toBe(false);
  });

  it("две задвижки внахлёст — отказ; вторая рядом — ок", () => {
    const first = draftAt(2, 2);
    const rows = placeBricksInRows({ 2: [] }, 2, [first], grid);
    expect(rows).not.toBeNull();
    const clash = placeBricksInRows(rows!, 2, [draftAt(3, 2)], grid);
    expect(clash).toBeNull();
    const apart = placeBricksInRows(rows!, 2, [{ ...draftAt(5, 2), id: "d2" }], grid);
    expect(apart).not.toBeNull();
  });

  it("обычный кирпич тапом задвижку не стирает", () => {
    const damper = draftAt(2, 2);
    const rows = placeBricksInRows({ 2: [damper] }, 2, [
      { id: "b", row: 2, x: 2, y: 2, kind: "plate", orientation: "h", custom: initialEditorState().plateSpec }
    ], grid);
    expect(rows).toBeNull(); // плита-накладная конфликтует с задвижкой и не заменяет её
  });
});

describe("toggleDamper", () => {
  it("переключает открыта/закрыта только у задвижки", () => {
    let state = initialEditorState();
    state = { ...state, currentRow: 2, activeTool: "damper" };
    const damper = draftAt(2, 2);
    state = editorReducer(state, { type: "place", bricks: [damper] });
    expect(state.rows[2].find((b) => b.id === damper.id)?.damperOpen).toBe(0);

    state = editorReducer(state, { type: "toggleDamper", id: damper.id });
    expect(state.rows[2].find((b) => b.id === damper.id)?.damperOpen).toBe(1);

    state = editorReducer(state, { type: "toggleDamper", id: damper.id });
    expect(state.rows[2].find((b) => b.id === damper.id)?.damperOpen).toBe(0);

    // чужой id — состояние не меняется
    const untouched = editorReducer(state, { type: "toggleDamper", id: "nope" });
    expect(untouched).toBe(state);
  });

  it("setDamperSize обновляет спеку инструмента", () => {
    let state = initialEditorState();
    state = editorReducer(state, { type: "setDamperSize", lengthMm: 250, widthMm: 250 });
    expect(state.damperSpec.w).toBe(2);
    expect(state.damperSpec.h).toBe(2);
  });
});

describe("damperBlockers — предупреждение о перекрытом канале", () => {
  it("сплошной кирпич под рамкой — помеха; vent и накладные — нет", () => {
    const damper = draftAt(2, 2);
    const solid: PlacedBrick = { id: "s", row: 2, x: 2, y: 2, kind: "standard", orientation: "h" };
    const vent: PlacedBrick = { id: "v", row: 2, x: 2, y: 2, kind: "vent", orientation: "h" };
    const aside: PlacedBrick = { id: "a", row: 2, x: 6, y: 6, kind: "standard", orientation: "h" };
    expect(damperBlockers([solid, vent, aside, damper], damper).map((b) => b.id)).toEqual(["s"]);
    expect(damperBlockers([vent, aside], damper)).toEqual([]);
  });
});

describe("материалы", () => {
  it("задвижка считается отдельной строкой и не тратит кирпич/раствор", () => {
    const damper = draftAt(2, 2);
    const brick: PlacedBrick = { id: "b", row: 1, x: 0, y: 0, kind: "standard", orientation: "h" };
    const est = estimateMaterials([damper, brick], DEFAULT_PARAMETERS);
    expect(est.dampers).toBe(1);
    expect(est.regularBricks).toBe(1);
    expect(est.total).toBe(2);
  });
});
