import { describe, expect, it } from "vitest";
import { historyReducer, initialHistoryState } from "../../../domain/editor/history";
import type { PlacedBrick } from "../../../domain/types";
import { TEPLUSHKA_DAMPERS } from "../../../domain/teplushkaControls";
import { inspectTeplushkaMode, teplushkaModeOpenings } from "../teplushkaInspection";

function fixture() {
  const initial = initialHistoryState();
  const gates: PlacedBrick[] = Object.values(TEPLUSHKA_DAMPERS).map((id, index) => ({
    id,
    kind: "damper",
    orientation: "h",
    row: index + 1,
    x: 2,
    y: 2,
    damperOpen: id === TEPLUSHKA_DAMPERS.main ? 1 : 0
  }));
  const editedBrick: PlacedBrick = {
    id: "user-edited-brick",
    row: 7,
    kind: "firebrick",
    orientation: "v",
    x: 3.4,
    y: 6.2
  };
  initial.present = {
    ...initial.present,
    currentRow: 7,
    rowCount: 33,
    lockedRows: [1, 2],
    rows: { ...Object.fromEntries(gates.map((brick) => [brick.row, [brick]])), 7: [editedBrick] }
  };
  return initial;
}

describe("source inspection changes actual stored dampers without replacing a user's copy", () => {
  it("switches the summer bypass as one undoable document action and preserves edits/selections", () => {
    const initial = fixture();
    const changed = historyReducer(initial, {
      type: "setDamperOpenings",
      openings: teplushkaModeOpenings("summer", TEPLUSHKA_DAMPERS)
    });
    expect(inspectTeplushkaMode(changed.present.rows, TEPLUSHKA_DAMPERS).mode).toBe("summer");
    expect(changed.past).toHaveLength(1);
    expect(changed.present.rows[7]).toBe(initial.present.rows[7]);
    expect(changed.present.currentRow).toBe(7);
    expect(changed.present.lockedRows).toEqual([1, 2]);
    expect(inspectTeplushkaMode(initial.present.rows, TEPLUSHKA_DAMPERS).mode).toBe("winter");
    const restored = historyReducer(changed, { type: "undo" });
    expect(restored.present.rows).toEqual(initial.present.rows);
    const redone = historyReducer(restored, { type: "redo" });
    expect(redone.present.rows).toEqual(changed.present.rows);
    const roundTrip = JSON.parse(JSON.stringify(redone.present.rows));
    expect(inspectTeplushkaMode(roundTrip, TEPLUSHKA_DAMPERS).mode).toBe("summer");
  });

  it("keeps ventilation separate from the firing modes and records the mouth closure", () => {
    const changed = historyReducer(fixture(), {
      type: "setDamperOpenings",
      openings: teplushkaModeOpenings("ventilation", TEPLUSHKA_DAMPERS)
    });
    const status = inspectTeplushkaMode(changed.present.rows, TEPLUSHKA_DAMPERS);
    expect(status.mode).toBe("ventilation");
    expect(status.gates.main?.damperOpen).toBe(0);
    expect(status.gates.summer?.damperOpen).toBe(0);
    expect(status.gates.hood?.damperOpen).toBe(1);
    expect(status.gates.mouth?.damperOpen).toBe(1);
  });

  it("does not mislabel a partial or missing gate as a complete source mode", () => {
    const initial = fixture();
    const partial = historyReducer(initial, {
      type: "setDamperOpenings",
      openings: { [TEPLUSHKA_DAMPERS.summer]: 0.0001 }
    });
    expect(inspectTeplushkaMode(partial.present.rows, TEPLUSHKA_DAMPERS)).toMatchObject({ complete: true, mode: null });
    const missing = { ...initial.present.rows, 4: [] };
    expect(inspectTeplushkaMode(missing, TEPLUSHKA_DAMPERS)).toMatchObject({ complete: false, mode: null });
  });

  it("does not add history for reselecting the existing mode or mutate non-damper elements", () => {
    const initial = fixture();
    expect(
      historyReducer(initial, {
        type: "setDamperOpenings",
        openings: teplushkaModeOpenings("winter", TEPLUSHKA_DAMPERS)
      })
    ).toBe(initial);
    expect(
      historyReducer(initial, {
        type: "setDamperOpenings",
        openings: { "user-edited-brick": 1, unknown: 0, [TEPLUSHKA_DAMPERS.summer]: Number.NaN }
      })
    ).toBe(initial);
  });
});
