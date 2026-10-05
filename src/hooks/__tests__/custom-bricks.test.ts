import { afterEach, expect, it, vi } from "vitest";
import { useCustomBricks } from "../useCustomBricks";
import { useState } from "react";
import type { CustomBrickSpec } from "../../domain/types";

vi.mock("react", () => ({
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void) => effect(),
  useRef: (current: unknown) => ({ current }),
  useState: vi.fn()
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

it("retains unsaved palette entries across additions and removals when storage is full", () => {
  const stored = { id: "existing", spec: { name: "Existing", w: 1, h: 1 } };
  const setItems = vi.fn();
  vi.mocked(useState).mockReturnValue([[], setItems] as never);
  vi.stubGlobal("localStorage", {
    getItem: vi.fn(() => JSON.stringify([stored])),
    setItem: vi.fn(() => {
      throw new Error("QuotaExceededError");
    })
  });
  const palette = useCustomBricks("tester");
  const spec: CustomBrickSpec = { name: "Cut", w: 1, h: 1 };
  const first = palette.addCustomBrick(spec);
  const second = palette.addCustomBrick(spec);
  expect(setItems).toHaveBeenLastCalledWith([stored, first, second]);
  palette.removeCustomBrick(stored.id);
  expect(setItems).toHaveBeenLastCalledWith([first, second]);
  vi.mocked(localStorage.setItem).mockImplementation(() => {});
  palette.removeCustomBrick(first.id);
  expect(setItems).toHaveBeenLastCalledWith([second]);
  expect(localStorage.setItem).toHaveBeenLastCalledWith("brick-stove-custom-bricks:tester", JSON.stringify([second]));
  // Once persisted, subsequent operations still observe newer storage contents.
  vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify([second, stored]));
  palette.removeCustomBrick(second.id);
  expect(setItems).toHaveBeenLastCalledWith([stored]);
});
