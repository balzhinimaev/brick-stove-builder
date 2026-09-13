import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { MasonryReviewPanel } from "../MasonryReviewPanel";
import type { PlacedBrick } from "../../domain/types";

it("uses the editable document, shows dimensions and accessible selection without a browser", () => {
  const bricks: PlacedBrick[] = [
    {
      id: "user-change",
      row: 5,
      kind: "custom",
      orientation: "h",
      x: 2,
      y: 2,
      custom: { name: "Edited insert", w: 10 / 125, h: 120 / 125, cutFrom: "standard" }
    }
  ];
  const html = renderToStaticMarkup(
    createElement(MasonryReviewPanel, {
      bricks,
      grid: { cols: 16, rows: 20, widthCm: 200, lengthCm: 250 },
      currentRow: 5,
      selectedIds: ["user-change"],
      onSelect: () => {},
      onClear: () => {}
    })
  );
  expect(html).toContain("10 × 120 × 65");
  expect(html).toContain('aria-pressed="true"');
  expect(html).toContain("Edited insert");
  expect(html).toContain("Ведомость CSV");
  expect(html).toContain("Геометрия JSON");
  expect(html).not.toContain("rp54-");
});
