import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMETERS } from "../constants";
import { gridFromParameters, placeBrickInRow, removeBrickAt } from "../geometry";
import type { PlacedBrick } from "../types";

describe("placement", () => {
  const grid = gridFromParameters(DEFAULT_PARAMETERS);
  it("adds a valid brick to an empty row", () => {
    const brick: PlacedBrick = { id: "a", row: 1, x: 1, y: 1, kind: "standard", orientation: "h" };
    expect(placeBrickInRow([], brick, grid)).toHaveLength(1);
  });
  it("removes a brick covering the tapped cell", () => {
    const existing: PlacedBrick[] = [{ id: "a", row: 1, x: 1, y: 1, kind: "standard", orientation: "h" }];
    expect(removeBrickAt(existing, 2, 1)).toHaveLength(0);
  });
});
