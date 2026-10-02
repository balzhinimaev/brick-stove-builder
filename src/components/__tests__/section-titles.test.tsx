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
