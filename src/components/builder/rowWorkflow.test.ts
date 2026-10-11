import { describe, expect, it, vi } from "vitest";
import { openRowDialog, confirmationValid, rowPage, rowShortcut, type RowContext } from "./rowWorkflow";
import { editorReducer, initialEditorState, type EditorAction } from "../../domain/editor";

const context: RowContext = { rows: {}, currentRow: 2, rowCount: 100, lockedRows: [], sceneRevision: 1, busy: false };
const pending = { action: "deleteCurrentRow" as const, context, trigger: null };
const key = {
  key: "PageDown",
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  isComposing: false,
  target: null
};

describe("row workspace transactions", () => {
  it("allows only the original unlocked document context", () => {
    expect(confirmationValid(pending, context)).toBe(true);
    for (const change of [
      { busy: true },
      { sceneRevision: 2 },
      { currentRow: 3 },
      { rowCount: 101 },
      { rows: {} },
      { lockedRows: [2] },
      { lockedRows: [5] }
    ]) {
      expect(confirmationValid(pending, { ...context, ...change })).toBe(false);
    }
  });
  it("keeps locked rows immune to clear, copy, delete and fill", () => {
    const state = { ...initialEditorState(), currentRow: 1, lockedRows: [1] };
    for (const action of [
      { type: "clearRow" },
      { type: "deleteRow" },
      { type: "copyRow", bricks: [] },
      { type: "place", bricks: state.rows[1] }
    ] as EditorAction[]) {
      expect(editorReducer(state, action)).toBe(state);
    }
  });
  it("pages across 100 courses and retains a filtered-out current course", () => {
    expect(rowPage({}, 100, 100, [], "all").visible).toEqual([97, 98, 99, 100]);
    expect(rowPage({}, 100, 12, [], "all").next).toBe(13);
    expect(rowPage({}, 100, 13, [], "all").previous).toBe(12);
    expect(rowPage({}, 100, 50, [], "nonempty").visible).toEqual([50]);
    expect(
      rowPage(
        {},
        100,
        50,
        Array.from({ length: 100 }, (_, i) => i + 1),
        "unfinished"
      ).visible
    ).toEqual([50]);
  });
  it("navigates and clamps without capturing arrows, undo, forms, modifiers or IME", () => {
    expect(rowShortcut(key, 50, 100, false)).toBe(51);
    expect(rowShortcut(key, 100, 100, false)).toBe(100);
    expect(rowShortcut({ ...key, key: "PageUp" }, 1, 100, false)).toBe(1);
    for (const keyName of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "z", "Enter", "Escape"])
      expect(rowShortcut({ ...key, key: keyName }, 50, 100, false)).toBeNull();
    for (const modifier of ["ctrlKey", "metaKey", "altKey", "shiftKey", "isComposing"])
      expect(rowShortcut({ ...key, [modifier]: true }, 50, 100, false)).toBeNull();
    expect(rowShortcut(key, 50, 100, true)).toBeNull();
    for (const target of [{ isContentEditable: true }, { closest: () => ({}) }])
      expect(rowShortcut({ ...key, target: target as unknown as EventTarget }, 50, 100, false)).toBeNull();
  });
});

it("focuses Cancel and restores the trigger on cancel or stale-context cleanup", () => {
  const dialog = { showModal: vi.fn(), close: vi.fn() };
  const cancel = { focus: vi.fn() };
  const trigger = { focus: vi.fn(), isConnected: true };
  const close = openRowDialog(dialog, cancel, trigger);
  expect(dialog.showModal).toHaveBeenCalledOnce();
  expect(cancel.focus).toHaveBeenCalledOnce();
  close();
  expect(dialog.close).toHaveBeenCalledOnce();
  expect(trigger.focus).toHaveBeenCalledOnce();
  trigger.isConnected = false;
  openRowDialog(dialog, cancel, trigger)();
  expect(trigger.focus).toHaveBeenCalledOnce();
});
