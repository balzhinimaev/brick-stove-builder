import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { PlacedBrick } from "../../domain/types";
import { ExactSection } from "../ExactSection";
import { MasonryReviewPanel } from "../MasonryReviewPanel";

it("renders complete section and part titles without React title warnings", () => {
  const bricks: PlacedBrick[] = [{ id: "piece-1", row: 2, kind: "standard", orientation: "h", x: 0, y: 0 }];
  const grid = { cols: 16, rows: 20, widthCm: 200, lengthCm: 250 };
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const exact = renderToStaticMarkup(<ExactSection bricks={bricks} grid={grid} row={2} />);
    const review = renderToStaticMarkup(
      <MasonryReviewPanel
        bricks={bricks}
        grid={grid}
        currentRow={2}
        selectedIds={[]}
        onSelect={() => {}}
        onClear={() => {}}
      />
    );
    expect(exact).toContain("<title>Сечение ряда 2, Z = 102.5 мм</title>");
    expect(exact).toContain("<title>№ 2.1 · standard · установка в ряду 2</title>");
    expect(review).toContain("<title>Сечение кладки ряда 2</title>");
    expect(review).toContain("<title>piece-1 · standard</title>");
    expect(error).not.toHaveBeenCalled();
  } finally {
    error.mockRestore();
  }
});

it("exposes selected parts in interactive sections without adding controls to print sections", () => {
  const bricks: PlacedBrick[] = [
    { id: "piece-1", row: 2, kind: "standard", orientation: "h", x: 0, y: 0 },
    { id: "piece-2", row: 2, kind: "standard", orientation: "h", x: 3, y: 0 }
  ];
  const grid = { cols: 16, rows: 20, widthCm: 200, lengthCm: 250 };
  for (const selectedIds of [[], ["piece-1"], ["piece-2"], ["piece-1", "piece-2"]]) {
    const markup = renderToStaticMarkup(
      <ExactSection bricks={bricks} grid={grid} row={2} selectedIds={selectedIds} onSelect={() => {}} />
    );
    const controls = markup.match(/<path[^>]*role="button"[^>]*>/g) ?? [];
    expect(controls).toHaveLength(2);
    controls.forEach((control, index) => {
      expect(control).toContain(`aria-pressed="${selectedIds.includes(bricks[index].id)}"`);
      expect(control).toContain(`aria-label="Деталь 2.${index + 1}, ряд установки 2"`);
      expect(control).toContain('tabindex="0"');
    });
    const printed = renderToStaticMarkup(
      <ExactSection bricks={bricks} grid={grid} row={2} selectedIds={selectedIds} />
    );
    expect(printed).not.toContain('role="button"');
    expect(printed).not.toContain("aria-pressed");
    expect(printed).not.toContain("tabindex");
  }
});
