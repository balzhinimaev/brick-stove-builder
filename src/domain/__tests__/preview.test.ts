import { describe, expect, it } from "vitest";
import { initialEditorState, buildPlacementDrafts, editorReducer } from "../editor";
import { previewPlacement, canConfirmPlacement, type PlacementPoint } from "../editor/preview";
import { planPlacement } from "../geometry";
import type { EditorState } from "../editor";
import type { PlacedBrick } from "../types";

const point: PlacementPoint = { x: 2, y: 2, rawX: 2.1, rawY: 2.1 };
const brick: PlacedBrick = { id: "existing", row: 2, x: 2, y: 2, kind: "standard", orientation: "h" };
const state = (overrides: Partial<EditorState> = {}): EditorState => ({
  ...initialEditorState(),
  rows: {},
  lockedRows: [],
  currentRow: 2,
  ...overrides
});

describe("3D placement transaction preview", () => {
  it("previews a valid draft without mutating the saved document", () => {
    const s = state();
    const before = JSON.stringify(s);
    const preview = previewPlacement(s, point);
    expect(canConfirmPlacement(preview)).toBe(true);
    expect(preview.bricks[0]).toMatchObject({ row: 2, x: 2, y: 2, kind: "standard" });
    expect(JSON.stringify(s)).toBe(before);
  });
  it("blocks implicit replacement in the interactive editor", () => {
    const preview = previewPlacement(state({ rows: { 2: [brick] } }), point);
    expect(preview.status).toBe("blocked");
    expect(preview.affected).toEqual([brick]);
    expect(canConfirmPlacement(preview)).toBe(false);
  });
  it("blocks a door extending up from a lower course", () => {
    const door = {
      ...brick,
      row: 1,
      kind: "cleanout" as const,
      custom: { name: "door", w: 2, h: 1, notch: null, heightMm: 210 }
    };
    expect(previewPlacement(state({ rows: { 1: [door] } }), point)).toMatchObject({
      status: "blocked",
      affected: [door]
    });
  });
  it.each(["eraser", "standard", "damper"] as const)("cannot confirm %s in a locked course", (activeTool) => {
    const preview = previewPlacement(state({ lockedRows: [2], activeTool, rows: { 2: [brick] } }), point);
    expect(preview.status).toBe("locked");
    expect(canConfirmPlacement(preview)).toBe(false);
  });
  it("identifies an overflowing brick before confirmation", () => {
    const s = state();
    expect(previewPlacement(s, { ...point, x: s.grid.cols - 1 }).status).toBe("outside");
  });
  it("erases a small off-grid cut by the actual hit rather than the snapped point", () => {
    const cut = { ...brick, kind: "custom" as const, x: 2.6, custom: { name: "cut", w: 0.3, h: 0.4, notch: null } };
    const preview = previewPlacement(state({ activeTool: "eraser", rows: { 2: [cut] } }), { ...point, rawX: 2.7 });
    expect(preview.status).toBe("erase");
    expect(preview.affected).toEqual([cut]);
  });
  it("erases the overlay before the masonry underneath", () => {
    const plate = { ...brick, id: "plate", kind: "plate" as const };
    expect(previewPlacement(state({ activeTool: "eraser", rows: { 2: [brick, plate] } }), point).affected).toEqual([
      plate
    ]);
  });
  it("uses the same exact hit for damper preview and toggle", () => {
    const damper = { ...brick, kind: "damper" as const, x: 2.5 };
    expect(
      previewPlacement(state({ activeTool: "damper", rows: { 2: [damper] } }), { ...point, rawX: 2.7 }).status
    ).toBe("toggle");
  });
  it.each(["grate", "plate"] as const)(
    "previews the committed %s seat and every automatic adjustment",
    (activeTool) => {
      const s = state({
        activeTool,
        rows: { 2: [brick] },
        plateSpec: { name: "plate", w: 2, h: 1, notch: null, flush: true, thicknessMm: 14 }
      });
      const preview = previewPlacement(s, point);
      const drafts = buildPlacementDrafts(s, point.x, point.y, () => 0);
      if (!drafts) throw new Error("Expected placement drafts");
      const planned = planPlacement(s.rows, s.currentRow, drafts, s.grid).rows;
      if (!planned) throw new Error("Expected valid placement");
      expect(preview.status).toBe("ready");
      expect(preview.bricks[0]).toEqual(planned[2].find((b) => b.id === drafts[0].id));
      expect(preview.adjustments.length).toBeGreaterThan(0);
      const committed = editorReducer(s, { type: "place", bricks: drafts });
      expect(committed.rows).toEqual(planned);
      expect(
        preview.adjustments.every(
          (b) =>
            committed.rows[2].includes(b) ||
            JSON.stringify(committed.rows[2].find((c) => c.id === b.id)) === JSON.stringify(b)
        )
      ).toBe(true);
    }
  );
  it("loads an existing document without a 2D mode or camera migration", () => {
    const draft = { parameters: state().parameters, rows: { 2: [brick] }, rowCount: 8, currentRow: 2, lockedRows: [1] };
    const loaded = editorReducer(state(), { type: "loadDraft", draft });
    expect(loaded.rows).toEqual(draft.rows);
    expect(loaded).not.toHaveProperty("viewMode");
    expect(loaded).not.toHaveProperty("camera");
  });
});
