import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { initialHistoryState, historyReducer } from "../editor/history";
import { resizedMasonry, partEditError } from "../editor/partEdit";
import { READY_PROJECTS } from "../projects";
import { estimateMaterials } from "../materials";
import { auditMasonry, masonryDimensions } from "../masonryAudit";
import { sectionsAtHeight, partNumbers } from "../masonrySections";
import { ExactSection } from "../../components/ExactSection";
import { gridFromParameters } from "../geometry";
import type { PlacedBrick } from "../types";
import { compareDocuments } from "../projectCompare";

const brick: PlacedBrick = {
  id: "a",
  x: 1,
  y: 1,
  row: 1,
  kind: "custom",
  orientation: "h",
  custom: { name: "Brick", w: 2, h: 0.96, heightMm: 65 }
};
describe("unified working geometry", () => {
  it("updates a part in place, blocks locked/colliding edits, and undoes in one step", () => {
    let state = initialHistoryState();
    state = {
      ...state,
      present: { ...state.present, lockedRows: [], rows: { 1: [brick, { ...brick, id: "b", x: 4 }] } }
    };
    const moved = { ...brick, x: 1.5 };
    const edited = historyReducer(state, { type: "editPart", originalId: "a", brick: moved });
    expect(edited.present.rows[1][0]).toEqual(moved);
    expect(historyReducer(edited, { type: "undo" }).present.rows).toEqual(state.present.rows);
    expect(historyReducer(state, { type: "editPart", originalId: "a", brick: { ...brick, x: 4 } })).toBe(state);
    expect(partEditError({ ...state.present, lockedRows: [1] }, "a", moved)).toMatch(/разблокируйте/);
    expect(historyReducer(state, { type: "editPart", originalId: "a", brick: { ...brick, x: NaN } })).toBe(state);
    expect(compareDocuments(state.present, edited.present).moved).toEqual(["a"]);
  });

  it("preserves a compound brick's cutout when resizing and does not mutate the original", () => {
    const compound: PlacedBrick = {
      ...brick,
      custom: {
        name: "Notch",
        w: 2,
        h: 0.96,
        solidParts: [
          { x1: 0, x2: 125, y1: 0, y2: 120, z1: 0, z2: 65 },
          { x1: 125, x2: 250, y1: 0, y2: 60, z1: 0, z2: 65 }
        ]
      }
    };
    const resized = resizedMasonry(compound, [200, 120, 65]);
    expect(resized.custom?.solidParts?.[1].x2).toBe(200);
    expect(resized.custom?.solidParts?.[1].y2).toBe(60);
    expect(compound.custom?.solidParts?.[1].x2).toBe(250);
    expect(masonryDimensions(resized)).toEqual([200, 120, 65]);
  });

  it("agrees between R2 inventory, review and screen/print sections", () => {
    const project = READY_PROJECTS.find((p) => p.id === "russian-house-6x9-r2")!;
    const all = Object.values(project.rows).flat();
    const audit = auditMasonry(all),
      materials = estimateMaterials(all, project.parameters);
    expect(materials.fullPieces).toBe(audit.full);
    expect(materials.fullPieces).toBe(881);
    expect(materials.rectangularPieces).toBe(audit.rectangular);
    expect(materials.shapedPieces).toBe(audit.shaped);
    expect(materials.mortarM3).toBeNull();
    const sectionRow = Array.from({ length: 29 }, (_, i) => i + 1).find((row) =>
      sectionsAtHeight(all, (row - 1) * 70 + 32.5).some((s) => s.brick.row < row)
    )!;
    expect(sectionRow).toBeGreaterThan(1);
    const slices = sectionsAtHeight(all, (sectionRow - 1) * 70 + 32.5);
    const html = renderToStaticMarkup(
      <ExactSection bricks={all} grid={gridFromParameters(project.parameters)} row={sectionRow} numbers />
    );
    for (const s of slices) expect(html).toContain(s.path);
    expect(html).toContain(partNumbers(all).get(slices[0].brick.id));
  });
});
