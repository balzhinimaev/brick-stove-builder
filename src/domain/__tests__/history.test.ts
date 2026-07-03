import { describe, expect, it } from "vitest";
import { historyReducer, initialHistoryState, type HistoryState } from "../editor";
import type { PlacedBrick } from "../types";

const brick = (x: number, row: number): PlacedBrick => ({ id: `b-${x}-${row}`, row, x, y: 0, kind: "standard", orientation: "h" });

function fresh(): HistoryState {
  const base = initialHistoryState();
  return { ...base, present: { ...base.present, currentRow: 2, lockedRows: [], rows: {} } };
}

describe("historyReducer", () => {
  it("records document mutations and undoes/redoes them", () => {
    let state = fresh();
    state = historyReducer(state, { type: "place", bricks: [brick(0, 2)] });
    state = historyReducer(state, { type: "place", bricks: [brick(4, 2)] });
    expect(state.present.rows[2]).toHaveLength(2);
    expect(state.past).toHaveLength(2);

    state = historyReducer(state, { type: "undo" });
    expect(state.present.rows[2]).toHaveLength(1);
    state = historyReducer(state, { type: "redo" });
    expect(state.present.rows[2]).toHaveLength(2);
  });

  it("does not record selection or camera changes", () => {
    let state = fresh();
    state = historyReducer(state, { type: "setTool", tool: "firebrick" });
    state = historyReducer(state, { type: "cameraZoom", delta: 0.08 });
    state = historyReducer(state, { type: "setCurrentRow", row: 1 });
    expect(state.past).toHaveLength(0);
    expect(state.present.activeTool).toBe("firebrick");
  });

  it("keeps the current tool and camera when undoing", () => {
    let state = fresh();
    state = historyReducer(state, { type: "place", bricks: [brick(0, 2)] });
    state = historyReducer(state, { type: "setTool", tool: "vent" });
    state = historyReducer(state, { type: "undo" });
    expect(state.present.activeTool).toBe("vent");
    expect(state.present.rows[2] ?? []).toHaveLength(0);
  });

  it("a new mutation clears the redo branch", () => {
    let state = fresh();
    state = historyReducer(state, { type: "place", bricks: [brick(0, 2)] });
    state = historyReducer(state, { type: "undo" });
    state = historyReducer(state, { type: "place", bricks: [brick(4, 2)] });
    expect(state.future).toHaveLength(0);
  });

  it("no-op actions (locked row) do not pollute history", () => {
    let state = fresh();
    state = { ...state, present: { ...state.present, lockedRows: [2] } };
    const next = historyReducer(state, { type: "place", bricks: [brick(0, 2)] });
    expect(next).toBe(state);
  });

  it("reset/loadDraft clear the timeline", () => {
    let state = fresh();
    state = historyReducer(state, { type: "place", bricks: [brick(0, 2)] });
    state = historyReducer(state, { type: "reset" });
    expect(state.past).toHaveLength(0);
    expect(state.future).toHaveLength(0);
  });

  it("undo keeps snap step, notch corner and picked custom brick", () => {
    let state = fresh();
    state = historyReducer(state, { type: "place", bricks: [brick(0, 2)] });
    state = historyReducer(state, { type: "setSnapStep", step: 0.5 });
    state = historyReducer(state, { type: "setNotchCorner", corner: "sw" });
    state = historyReducer(state, { type: "pickCustomBrick", spec: { name: "трёхчетвертка", w: 1.52, h: 0.96, notch: null } });
    state = historyReducer(state, { type: "undo" });
    expect(state.present.snapStep).toBe(0.5);
    expect(state.present.notchCorner).toBe("sw");
    expect(state.present.customBrick?.name).toBe("трёхчетвертка");
    expect(state.present.rows[2] ?? []).toHaveLength(0); // документ откатился
  });
});
