import { describe, expect, it } from "vitest";
import {
  initialEditorState,
  editorReducer,
  plateSpecFromMm,
  grateSpecFromMm,
  historyReducer,
  type HistoryState
} from "../editor";
import { canConfirmPlacement, previewPlacement } from "../editor/preview";
import { brickBounds, brickSolids, cutBrickForPlate, notchBox, overlaps3D, planPlacement } from "../geometry";
import type { NotchCorner, Orientation, PlacedBrick } from "../types";

const grid = initialEditorState().grid;
const support = (overrides: Partial<PlacedBrick> = {}): PlacedBrick => ({
  id: "support",
  row: 2,
  x: 2,
  y: 2,
  kind: "custom",
  orientation: "h",
  custom: { name: "Cut brick", w: 2, h: 1, notch: { x1: 1, y1: 0, x2: 2, y2: 1 }, notchDepthMm: 14 },
  ...overrides
});
const plate = (overrides: Partial<PlacedBrick> = {}): PlacedBrick => ({
  id: "plate",
  row: 2,
  x: 3,
  y: 2,
  kind: "plate",
  orientation: "h",
  custom: plateSpecFromMm(125, 125, 14, true),
  ...overrides
});
const specOf = (brick: PlacedBrick) => {
  if (!brick.custom) throw new Error("Expected a custom specification");
  return brick.custom;
};
const resultRow = (plan: ReturnType<typeof planPlacement>) => {
  if (!plan.rows) throw new Error("Expected a valid placement");
  return plan.rows[2];
};
const noIntersections = (bricks: PlacedBrick[]) => {
  for (const [i, a] of bricks.entries()) {
    for (const b of bricks.slice(i + 1)) expect(overlaps3D(a, b), `${a.id} / ${b.id}`).toBe(false);
  }
};

describe("flush seating preserves the cut material", () => {
  it("never restores a deeper cut to make a thin plate appear flush", () => {
    const brick = support({ custom: { ...specOf(support()), notchDepthMm: 35 } });
    const cut = cutBrickForPlate(brick, plate(), 14);
    expect(cut).toBe(brick);
    expect(planPlacement({ 2: [brick] }, 2, [plate()], grid).rows).toBeNull();
  });

  it.each([false, true, undefined])("a 65 mm through-cut remains a hole (ledge=%s)", (ledge) => {
    const brick = support({ custom: { ...specOf(support()), notchDepthMm: 65, ledge } });
    const before = JSON.stringify(brick);
    expect(planPlacement({ 2: [brick] }, 2, [plate()], grid).rows).toBeNull();
    expect(JSON.stringify(brick)).toBe(before);
  });

  it("the through-cut flag takes precedence over an old saved shallow depth", () => {
    const brick = support({ custom: { ...specOf(support()), ledge: false, notchDepthMm: 14 } });
    const filler = support({ id: "filler", x: 3, custom: { name: "Filler", w: 1, h: 1 } });
    expect(overlaps3D(brick, filler)).toBe(false);
    noIntersections(resultRow(planPlacement({ 2: [brick] }, 2, [filler], grid)));
  });

  it.each(["custom", "standard", "cut", "firebrick"] as const)(
    "cuts a rectangular %s block from the cutter",
    (kind) => {
      const brick = support({
        kind,
        custom: kind === "custom" ? { name: "Shortened", w: 2, h: 1, notch: null } : undefined
      });
      const placed = resultRow(planPlacement({ 2: [brick] }, 2, [plate({ x: 2 })], grid));
      const cut = placed.find((b) => b.id === brick.id);
      expect(cut?.custom?.notchDepthMm).toBe(14);
      noIntersections(placed);
    }
  );

  it("does not accept an empty course or a vent as a flush support", () => {
    for (const bricks of [[], [support({ kind: "vent", custom: undefined })]]) {
      expect(planPlacement({ 2: bricks }, 2, [plate()], grid).rows).toBeNull();
    }
  });

  it("preserves a deeper adjacent ledge when another ledge provides contact", () => {
    const deep = support({ custom: { ...specOf(support()), notchDepthMm: 35 } });
    const exact = support({ id: "exact", y: 3 });
    const draft = plate({ custom: plateSpecFromMm(125, 250, 14, true) });
    const placed = resultRow(planPlacement({ 2: [deep, exact] }, 2, [draft], grid));
    expect(placed.find((b) => b.id === deep.id)).toBe(deep);
    expect(placed.find((b) => b.id === draft.id)?.custom?.seatZMm).toBe(51);
    noIntersections(placed);
  });

  it("rejects an additional cut that would remove an existing plate's last support", () => {
    const base = support({ custom: { name: "Base", w: 2, h: 1, notch: null } });
    const first = plate({ x: 2 });
    const rows = planPlacement({ 2: [base] }, 2, [first], grid).rows;
    if (!rows) throw new Error("Expected first plate to fit");
    const before = JSON.stringify(rows);
    const second = plate({ id: "second", custom: plateSpecFromMm(125, 125, 22, true) });
    expect(planPlacement(rows, 2, [second], grid).rows).toBeNull();
    expect(JSON.stringify(rows)).toBe(before);
  });

  it("rejects mutually intersecting parts in a placement assembly", () => {
    const a = support({ kind: "standard", custom: undefined });
    const b = { ...a, id: "other", x: 2.5 };
    expect(planPlacement({}, 2, [a, b], grid).rows).toBeNull();
  });
});

describe("cut fit in both orientations", () => {
  const corners: NotchCorner[] = ["nw", "ne", "sw", "se", "n", "e", "s", "w"];
  const cases = (["h", "v"] as Orientation[]).flatMap((orientation) =>
    corners.map((notchCorner) => ({ orientation, notchCorner }))
  );

  it.each(cases)(
    "seats on $notchCorner, orientation $orientation, with exact contact",
    ({ orientation, notchCorner }) => {
      const brick = support({
        kind: "rebate",
        orientation,
        notchCorner,
        custom: { name: "", w: 2, h: 1, notchDepthMm: 14 }
      });
      const notch = notchBox(brick);
      if (!notch) throw new Error("Expected notch");
      const draft = plate({
        x: notch.x1,
        y: notch.y1,
        custom: plateSpecFromMm((notch.x2 - notch.x1) * 125, (notch.y2 - notch.y1) * 125, 14, true)
      });
      const placed = resultRow(planPlacement({ 2: [brick] }, 2, [draft], grid));
      expect(placed.find((b) => b.id === brick.id)).toBe(brick);
      const fitted = placed.find((b) => b.id === draft.id);
      if (!fitted) throw new Error("Expected fitted plate");
      expect(brickSolids(fitted)[0]).toMatchObject({ z1: 51, z2: 65 });
      noIntersections(placed);
    }
  );

  it.each(["h", "v"] as const)("fits a full-height brick into a decimal through-cut (%s)", (orientation) => {
    const brick = support({
      orientation,
      custom: { name: "Through", w: 2, h: 0.96, notch: { x1: 0.96, y1: 0.48, x2: 2, y2: 0.96 }, notchDepthMm: 65 }
    });
    const notch = notchBox(brick);
    if (!notch) throw new Error("Expected notch");
    const filler = support({
      id: "filler",
      x: notch.x1,
      y: notch.y1,
      custom: { name: "Filler", w: notch.x2 - notch.x1, h: notch.y2 - notch.y1 }
    });
    const s = {
      ...initialEditorState(),
      rows: { 2: [brick] },
      currentRow: 2,
      lockedRows: [],
      activeTool: "custom" as const,
      customBrick: specOf(filler)
    };
    const preview = previewPlacement(s, { x: filler.x, y: filler.y, rawX: filler.x, rawY: filler.y });
    expect(canConfirmPlacement(preview)).toBe(true);
    const committed = editorReducer(s, { type: "place", bricks: [filler] });
    expect(committed.rows[2]).toHaveLength(2);
    noIntersections(committed.rows[2]);
    expect(brickBounds(committed.rows[2][1])).toEqual(notch);
  });

  it("blocks a full-height brick on a shallow ledge without replacing its host", () => {
    const brick = support();
    const s = {
      ...initialEditorState(),
      rows: { 2: [brick] },
      currentRow: 2,
      lockedRows: [],
      activeTool: "cut" as const
    };
    const preview = previewPlacement(s, { x: 3, y: 2, rawX: 3, rawY: 2 });
    expect(canConfirmPlacement(preview)).toBe(false);
    expect(preview.affected).toContain(brick);
  });
});

describe("seating transaction integrity", () => {
  it("reports missing support in preview and leaves no rejected action in undo", () => {
    const brick = support({ custom: { ...specOf(support()), notchDepthMm: 35 } });
    const present = {
      ...initialEditorState(),
      currentRow: 2,
      rows: { 2: [brick] },
      lockedRows: [],
      activeTool: "plate" as const,
      plateSpec: specOf(plate())
    };
    const preview = previewPlacement(present, { x: 3, y: 2, rawX: 3, rawY: 2 });
    expect(preview.status).toBe("unsupported");
    expect(canConfirmPlacement(preview)).toBe(false);
    expect(preview.affected.map((b) => b.id)).toContain(brick.id);
    const history: HistoryState = { past: [], present, future: [] };
    expect(historyReducer(history, { type: "place", bricks: [plate()] })).toBe(history);
  });

  it("undo/redo and a saved row restore the plate together with its cut", () => {
    const brick = support({ kind: "standard", custom: undefined });
    const before: HistoryState = {
      past: [],
      future: [],
      present: { ...initialEditorState(), currentRow: 2, rows: { 2: [brick] }, lockedRows: [] }
    };
    const placed = historyReducer(before, { type: "place", bricks: [plate()] });
    expect(placed.past).toHaveLength(1);
    const undone = historyReducer(placed, { type: "undo" });
    expect(undone.present.rows).toEqual(before.present.rows);
    expect(historyReducer(undone, { type: "redo" }).present.rows).toEqual(placed.present.rows);
    const restored = JSON.parse(JSON.stringify(placed.present.rows)) as Record<number, PlacedBrick[]>;
    noIntersections(restored[2]);
    const restoredPlate = restored[2].find((b) => b.kind === "plate");
    if (!restoredPlate) throw new Error("Expected saved plate");
    expect(brickSolids(restoredPlate)[0]).toMatchObject({ z1: 51, z2: 65 });
    const copies = restored[2].map((b) => ({ ...b, id: `${b.id}-copy`, row: 3 }));
    const copied = editorReducer({ ...placed.present, currentRow: 3 }, { type: "copyRow", bricks: copies });
    expect(copied.rows[3]).toHaveLength(2);
    noIntersections(Object.values(copied.rows).flat());
  });

  it.each(["h", "v"] as const)(
    "keeps decimal grate rings disjoint, flush and unchanged on repeated placement (%s)",
    (orientation) => {
      for (const [length, width] of [
        [200, 125],
        [235, 130],
        [300, 200],
        [375, 250],
        [410, 340],
        [500, 375]
      ]) {
        for (const [x, y] of [
          [0, 0],
          [2.5, 2.5]
        ]) {
          const grate = plate({
            id: "grate",
            kind: "grate",
            x,
            y,
            orientation,
            custom: grateSpecFromMm(length, width, 22)
          });
          const placed = resultRow(planPlacement({}, 2, [grate], grid));
          noIntersections(placed);
          expect(placed.find((b) => b.id === grate.id)?.custom?.seatZMm).toBe(43);
          const repeated = resultRow(planPlacement({ 2: placed }, 2, [grate], grid));
          expect(new Set(repeated.map((b) => b.id)).size).toBe(repeated.length);
          expect([...repeated].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
            [...placed].sort((a, b) => a.id.localeCompare(b.id))
          );
        }
      }
    }
  );

  it("cutting in either orientation only removes volume and preserves the footprint", () => {
    for (const orientation of ["h", "v"] as const) {
      for (const depth of [5, 14, 35, 65]) {
        for (const thickness of [14, 22, 40]) {
          const brick = support({
            orientation,
            custom: { ...specOf(support()), notchDepthMm: depth, cutFrom: "firebrick" }
          });
          const bounds = brickBounds(brick);
          const cut = cutBrickForPlate(brick, plate({ x: bounds.x1, y: bounds.y1 }), thickness);
          if (!cut) continue; // A second depth alongside a through-cut is not representable.
          expect(brickBounds(cut)).toEqual(bounds);
          expect(cut.custom?.cutFrom).toBe("firebrick");
          const previous = brickSolids(brick);
          for (const solid of brickSolids(cut)) {
            const volume = (solid.box.x2 - solid.box.x1) * (solid.box.y2 - solid.box.y1) * (solid.z2 - solid.z1);
            const covered = previous.reduce(
              (sum, old) =>
                sum +
                Math.max(0, Math.min(solid.box.x2, old.box.x2) - Math.max(solid.box.x1, old.box.x1)) *
                  Math.max(0, Math.min(solid.box.y2, old.box.y2) - Math.max(solid.box.y1, old.box.y1)) *
                  Math.max(0, Math.min(solid.z2, old.z2) - Math.max(solid.z1, old.z1)),
              0
            );
            expect(covered).toBeCloseTo(volume, 10);
          }
        }
      }
    }
  });
});
