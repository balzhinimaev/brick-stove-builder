import { Children, isValidElement, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { masonryCsv } from "../../domain/masonryAudit";
import type { PlacedBrick } from "../../domain/types";
import { MasonryReviewPanel } from "../MasonryReviewPanel";

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useMemo: (compute: () => unknown) => compute(),
  useState: (initial: unknown) => [initial, vi.fn()]
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it.each(["csv", "json"])("downloads the current masonry %s with an attached, safely released link", async (format) => {
  vi.useFakeTimers();
  let attached = false;
  const anchor = {
    href: "",
    download: "",
    click: vi.fn(() => expect(attached).toBe(true)),
    remove: vi.fn(() => {
      attached = false;
    })
  };
  vi.stubGlobal("document", {
    createElement: () => anchor,
    body: {
      append: () => {
        attached = true;
      }
    }
  });
  const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:parts");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const bricks: PlacedBrick[] = [{ id: "edited", row: 2, kind: "standard", orientation: "h", x: 1, y: 2 }];
  const tree = MasonryReviewPanel({
    bricks,
    grid: { cols: 16, rows: 20, widthCm: 200, lengthCm: 250 },
    currentRow: 2,
    selectedIds: [],
    onSelect: () => {},
    onClear: () => {}
  });
  const label = format === "csv" ? "Ведомость CSV" : "Геометрия JSON";
  function clickExport(node: ReactNode) {
    Children.forEach(node, (child) => {
      if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(child)) return;
      if (child.type === "button" && child.props.children === label) child.props.onClick?.();
      else clickExport(child.props.children);
    });
  }
  clickExport(tree);
  expect(anchor.click).toHaveBeenCalledOnce();
  expect(anchor.remove).toHaveBeenCalledOnce();
  expect(anchor.download).toBe(`masonry-parts.${format}`);
  expect(anchor.href).toBe("blob:parts");
  const blob = create.mock.calls[0][0] as Blob;
  expect(blob.type).toBe(format === "csv" ? "text/csv;charset=utf-8" : "application/json");
  const body = await blob.text();
  if (format === "csv")
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new TextEncoder().encode(masonryCsv(bricks)));
  else
    expect(JSON.parse(body)).toMatchObject({
      format: "masonry-part-schedule-v1",
      parts: bricks,
      summary: { total: 1 }
    });
  vi.advanceTimersByTime(1500);
  expect(revoke).not.toHaveBeenCalled();
  vi.runAllTimers();
  expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:parts");
});
