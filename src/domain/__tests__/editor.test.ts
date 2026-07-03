import { describe, expect, it } from "vitest";
import { editorReducer, initialEditorState, type EditorState } from "../editor";
import { READY_PROJECTS } from "../projects";
import type { PlacedBrick } from "../types";

function freshOnRow(row: number, locked: number[] = []): EditorState {
  return { ...initialEditorState(), currentRow: row, lockedRows: locked, rows: {} };
}

const standard = (x: number, y: number): PlacedBrick => ({ id: `b-${x}-${y}`, row: 1, x, y, kind: "standard", orientation: "h" });

describe("place", () => {
  it("adds a valid brick to the current row", () => {
    const next = editorReducer(freshOnRow(2), { type: "place", bricks: [{ ...standard(1, 1), row: 2 }] });
    expect(next.rows[2]).toHaveLength(1);
  });

  it("refuses to place into a locked row", () => {
    const state = freshOnRow(2, [2]);
    const next = editorReducer(state, { type: "place", bricks: [{ ...standard(1, 1), row: 2 }] });
    expect(next).toBe(state);
  });

  it("rejects a brick that overflows the grid", () => {
    const state = freshOnRow(2);
    const next = editorReducer(state, { type: "place", bricks: [{ ...standard(state.grid.cols, 1), row: 2 }] });
    expect(next.rows[2] ?? []).toHaveLength(0);
  });

  it("replaces an overlapping brick instead of stacking", () => {
    let state = editorReducer(freshOnRow(2), { type: "place", bricks: [{ ...standard(1, 1), row: 2 }] });
    state = editorReducer(state, { type: "place", bricks: [{ ...standard(2, 1), id: "new", row: 2 }] });
    expect(state.rows[2]).toHaveLength(1);
    expect(state.rows[2][0].id).toBe("new");
  });
});

describe("erase", () => {
  it("removes a brick covering the tapped cell, respecting locks", () => {
    let state = editorReducer(freshOnRow(2), { type: "place", bricks: [{ ...standard(1, 1), row: 2 }] });
    const locked = editorReducer({ ...state, lockedRows: [2] }, { type: "erase", x: 1, y: 1 });
    expect(locked.rows[2]).toHaveLength(1);
    state = editorReducer(state, { type: "erase", x: 2, y: 1 });
    expect(state.rows[2]).toHaveLength(0);
  });
});

describe("rows", () => {
  it("addRow grows the count and selects the new row", () => {
    const next = editorReducer(initialEditorState(), { type: "addRow" });
    expect(next.rowCount).toBe(initialEditorState().rowCount + 1);
    expect(next.currentRow).toBe(next.rowCount);
  });

  it("lockRow records the row and advances, clamped to rowCount", () => {
    const next = editorReducer({ ...initialEditorState(), currentRow: 3, lockedRows: [] }, { type: "lockRow" });
    expect(next.lockedRows).toContain(3);
    expect(next.currentRow).toBe(4);
    const atEnd = editorReducer({ ...initialEditorState(), currentRow: initialEditorState().rowCount }, { type: "lockRow" });
    expect(atEnd.currentRow).toBe(initialEditorState().rowCount);
  });

  it("unlockRow removes only the current row", () => {
    const next = editorReducer({ ...initialEditorState(), currentRow: 1, lockedRows: [1, 5] }, { type: "unlockRow" });
    expect(next.lockedRows).toEqual([5]);
  });

  it("clearRow empties the current row unless locked", () => {
    let state = editorReducer(freshOnRow(2), { type: "place", bricks: [{ ...standard(1, 1), row: 2 }] });
    state = editorReducer(state, { type: "clearRow" });
    expect(state.rows[2]).toHaveLength(0);
  });

  it("copyRow ignores row 1 and locked rows", () => {
    const onFirst = freshOnRow(1);
    expect(editorReducer(onFirst, { type: "copyRow", bricks: [standard(1, 1)] })).toBe(onFirst);
    const locked = freshOnRow(2, [2]);
    expect(editorReducer(locked, { type: "copyRow", bricks: [standard(1, 1)] })).toBe(locked);
  });
});

describe("updateParameter", () => {
  it("clamps to bounds and recomputes the grid", () => {
    const next = editorReducer(initialEditorState(), { type: "updateParameter", key: "foundationWidth", value: 9999 });
    expect(next.parameters.foundationWidth).toBe(220);
    expect(next.grid.cols).toBe(Math.round(220 / 12.5));
  });

  it("prunes bricks that fall outside the shrunken grid", () => {
    let state = freshOnRow(2);
    state = editorReducer(state, { type: "place", bricks: [{ ...standard(state.grid.cols - 2, state.grid.rows - 1), row: 2 }] });
    expect(state.rows[2]).toHaveLength(1);
    const shrunk = editorReducer(state, { type: "updateParameter", key: "foundationWidth", value: 70 });
    expect(shrunk.rows[2]).toHaveLength(0);
  });
});

describe("loadProject / reset", () => {
  it("loads a ready project at row 1 with cloned rows", () => {
    const project = READY_PROJECTS[0];
    const next = editorReducer(initialEditorState(), { type: "loadProject", project });
    expect(next.currentRow).toBe(1);
    expect(next.rowCount).toBe(project.rowCount);
    expect(next.rows[1]).not.toBe(project.rows[1]); // cloned, not shared
    expect(next.parameters).toEqual(project.parameters);
  });

  it("reset returns a pristine editor", () => {
    const dirty = editorReducer(initialEditorState(), { type: "addRow" });
    expect(editorReducer(dirty, { type: "reset" })).toEqual(initialEditorState());
  });
});

describe("camera", () => {
  it("clamps zoom and wraps angle", () => {
    let s = initialEditorState();
    s = editorReducer(s, { type: "cameraZoom", delta: 10 });
    expect(s.camera.zoom).toBe(1.55);
    s = editorReducer(s, { type: "cameraRotate", delta: -15 });
    expect(s.camera.angle).toBe(345);
    s = editorReducer(s, { type: "cameraReset" });
    expect(s.camera).toEqual(initialEditorState().camera);
  });
});

describe("deleteRow", () => {
  it("removes the current row, renumbers higher rows and shifts locks", () => {
    let state: EditorState = { ...freshOnRow(2), rowCount: 4, lockedRows: [1, 3] };
    state = { ...state, rows: { 1: [standard(0, 0)], 2: [{ ...standard(2, 0), row: 2 }], 3: [{ ...standard(4, 0), row: 3 }] } };
    const next = editorReducer(state, { type: "deleteRow" });
    expect(next.rowCount).toBe(3);
    expect(next.currentRow).toBe(2);
    expect(next.rows[1]).toHaveLength(1);
    expect(next.rows[2][0].x).toBe(4); // former row 3 shifted down
    expect(next.rows[2][0].row).toBe(2);
    expect(next.lockedRows).toEqual([1, 2]);
  });

  it("refuses on a locked row and on the last remaining row", () => {
    const locked: EditorState = { ...freshOnRow(2, [2]), rowCount: 3 };
    expect(editorReducer(locked, { type: "deleteRow" })).toBe(locked);
    const single: EditorState = { ...freshOnRow(1), rowCount: 1 };
    expect(editorReducer(single, { type: "deleteRow" })).toBe(single);
  });
});
