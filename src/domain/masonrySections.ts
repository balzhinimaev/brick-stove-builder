/** Outline the union of axis-aligned slices belonging to ONE physical brick.
 * Computational box boundaries are not saw cuts or mortar joints. */
export function compoundSectionOutline(polygons: { x: number; y: number }[][]): string {
  if (!polygons.length) return "";
  const boxes = polygons.map((p) => ({
    x1: Math.min(...p.map((v) => v.x)),
    x2: Math.max(...p.map((v) => v.x)),
    y1: Math.min(...p.map((v) => v.y)),
    y2: Math.max(...p.map((v) => v.y))
  }));
  const unique = (values: number[]) => [...new Set(values.map((v) => Math.round(v * 1e6) / 1e6))].sort((a, b) => a - b);
  const xs = unique(boxes.flatMap((b) => [b.x1, b.x2])),
    ys = unique(boxes.flatMap((b) => [b.y1, b.y2]));
  const occupied = xs.slice(0, -1).map((x, i) =>
    ys.slice(0, -1).map((y, j) =>
      boxes.some((b) => {
        const cx = (x + xs[i + 1]) / 2,
          cy = (y + ys[j + 1]) / 2;
        return cx > b.x1 && cx < b.x2 && cy > b.y1 && cy < b.y2;
      })
    )
  );
  const lines: string[] = [];
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < ys.length - 1; j++) {
      if (!occupied[i][j]) continue;
      if (!occupied[i - 1]?.[j]) lines.push(`M${xs[i]},${ys[j]}L${xs[i]},${ys[j + 1]}`);
      if (!occupied[i + 1]?.[j]) lines.push(`M${xs[i + 1]},${ys[j]}L${xs[i + 1]},${ys[j + 1]}`);
      if (!occupied[i]?.[j - 1]) lines.push(`M${xs[i]},${ys[j]}L${xs[i + 1]},${ys[j]}`);
      if (!occupied[i]?.[j + 1]) lines.push(`M${xs[i]},${ys[j + 1]}L${xs[i + 1]},${ys[j + 1]}`);
    }
  return lines.join(" ");
}
