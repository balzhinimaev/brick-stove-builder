import type { PlacedBrick } from "./types";

export function partNumbers(bricks: PlacedBrick[]): Map<string, string> {
  const counts = new Map<number, number>();
  return new Map(
    bricks.map((b) => {
      const count = (counts.get(b.row) ?? 0) + 1;
      counts.set(b.row, count);
      return [b.id, `${b.row}.${count}`];
    })
  );
}
