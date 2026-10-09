import { Children, isValidElement, type ReactNode, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { ExactSection } from "../ExactSection";
import type { PlacedBrick } from "../../domain/types";

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useMemo: (factory: () => unknown) => factory(),
  useState: vi.fn()
}));
afterEach(() => vi.resetAllMocks());

const brick: PlacedBrick = { id: "brick", kind: "standard", row: 1, x: 0, y: 0, orientation: "h" };

type PathProps = {
  children?: ReactNode;
  "aria-disabled"?: boolean;
  onClick?: () => void;
  onKeyDown?: (event: { key: string; preventDefault: () => void }) => void;
};

function selectablePath(node: ReactNode): PathProps | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<PathProps>(child)) continue;
    if (child.type === "path" && child.props.onKeyDown) return child.props;
    const found = selectablePath(child.props.children);
    if (found) return found;
  }
}

it.each([false, true])("keeps pointer and keyboard selection consistent in measurement mode=%s", (measure) => {
  vi.mocked(useState)
    .mockReturnValueOnce([measure, vi.fn()] as never)
    .mockReturnValueOnce([[], vi.fn()] as never);
  const onSelect = vi.fn();
  const path = selectablePath(
    ExactSection({
      bricks: [brick],
      grid: { cols: 8, rows: 8, widthCm: 100, lengthCm: 100 },
      row: 1,
      measurement: true,
      onSelect
    })
  );
  expect(path).toBeDefined();
  expect(path?.["aria-disabled"]).toBe(measure);
  path?.onClick?.();
  for (const key of ["Enter", " "]) {
    const preventDefault = vi.fn();
    path?.onKeyDown?.({ key, preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(measure ? 0 : 1);
  }
  expect(onSelect.mock.calls).toEqual(
    measure
      ? []
      : [
          [["brick"], 1],
          [["brick"], 1],
          [["brick"], 1]
        ]
  );
  const preventDefault = vi.fn();
  path?.onKeyDown?.({ key: "ArrowRight", preventDefault });
  expect(preventDefault).not.toHaveBeenCalled();
  expect(onSelect).toHaveBeenCalledTimes(measure ? 0 : 3);
});

it("does not consume activation keys in a noninteractive print section", () => {
  vi.mocked(useState)
    .mockReturnValueOnce([false, vi.fn()] as never)
    .mockReturnValueOnce([[], vi.fn()] as never);
  const path = selectablePath(
    ExactSection({ bricks: [brick], grid: { cols: 8, rows: 8, widthCm: 100, lengthCm: 100 }, row: 1 })
  );
  expect(path).toBeDefined();
  expect(path?.["aria-disabled"]).toBeUndefined();
  for (const key of ["Enter", " "]) {
    const preventDefault = vi.fn();
    path?.onKeyDown?.({ key, preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
  }
});
