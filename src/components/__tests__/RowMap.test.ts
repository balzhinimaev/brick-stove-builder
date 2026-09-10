import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { type BrickBox, brickBoxes, gridFromParameters, notchBox } from "../../domain/geometry";
import { makeTeplushka15 } from "../../domain/teplushka15";
import type { GridSpec, PlacedBrick } from "../../domain/types";
import { RowMap } from "../RowMap";

const grid: GridSpec = { cols: 13, rows: 13, widthCm: 162.5, lengthCm: 162.5 };

function rectangles(bricks: PlacedBrick[], variant: "screen" | "print", mapGrid = grid) {
  const svg = renderToStaticMarkup(createElement(RowMap, { grid: mapGrid, bricks, variant }));
  return [...svg.matchAll(/<rect\b([^>]*)>/g)]
    .slice(1) // The first rectangle is the map frame, not a physical part.
    .map((match) => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]])));
}

function expectPhysicalFootprint(rect: Record<string, string>, box: BrickBox, cell: number, pad: number) {
  const x = Number(rect.x);
  const y = Number(rect.y);
  const width = Number(rect.width);
  const height = Number(rect.height);
  const stroke = Number(rect["stroke-width"]);
  const realWidth = (box.x2 - box.x1) * cell;
  const realHeight = (box.y2 - box.y1) * cell;
  expect(width).toBeGreaterThan(0);
  expect(height).toBeGreaterThan(0);
  expect(width).toBeGreaterThanOrEqual(realWidth / 2);
  expect(height).toBeGreaterThanOrEqual(realHeight / 2);
  expect(x + width / 2).toBeCloseTo(pad + ((box.x1 + box.x2) / 2) * cell, 10);
  expect(y + height / 2).toBeCloseTo(pad + ((box.y1 + box.y2) / 2) * cell, 10);
  // Including its outline, no shape may inflate into a neighboring void/part.
  expect(x - stroke / 2).toBeGreaterThanOrEqual(pad + box.x1 * cell - 1e-10);
  expect(y - stroke / 2).toBeGreaterThanOrEqual(pad + box.y1 * cell - 1e-10);
  expect(x + width + stroke / 2).toBeLessThanOrEqual(pad + box.x2 * cell + 1e-10);
  expect(y + height + stroke / 2).toBeLessThanOrEqual(pad + box.y2 * cell + 1e-10);
}

describe.each(["screen", "print"] as const)("%s row map thin-part rendering", (variant) => {
  const cell = variant === "screen" ? 112 / 13 : 220 / 13;
  const pad = variant === "screen" ? 9 : 1;

  it.each(["h", "v"] as const)("retains a 3 mm steel section in orientation %s without widening it", (orientation) => {
    const steel: PlacedBrick = {
      id: "thin-steel",
      row: 11,
      x: 1,
      y: 1,
      kind: "custom",
      orientation,
      custom: { name: "3 mm steel section", material: "steel", w: 3 / 125, h: 1030 / 125 }
    };
    const rects = rectangles([steel], variant);
    expect(rects).toHaveLength(1);
    expect(rects[0].fill).toBe("#535c62");
    expectPhysicalFootprint(rects[0], brickBoxes(steel)[0], cell, pad);
  });

  it.each(["h", "v"] as const)("retains a thin ledge and its masonry body in orientation %s", (orientation) => {
    const brick: PlacedBrick = {
      id: "thin-ledge",
      row: 11,
      x: 2,
      y: 3,
      kind: "custom",
      orientation,
      custom: {
        name: "Thin seat",
        w: 2,
        h: 1,
        notch: { x1: 0, y1: 0, x2: 2, y2: 4 / 125 },
        ledge: true,
        notchDepthMm: 20
      }
    };
    const ledge = notchBox(brick);
    if (!ledge) throw new Error("Fixture must contain a ledge");
    const rects = rectangles([brick], variant);
    expect(rects).toHaveLength(2);
    expect(rects[0].opacity).toBe("0.38");
    expectPhysicalFootprint(rects[0], ledge, cell, pad);
    expectPhysicalFootprint(rects[1], brickBoxes(brick)[0], cell, pad);
  });

  it("renders every actual Teplushka row box with positive finite SVG dimensions", () => {
    const project = makeTeplushka15();
    const projectGrid = gridFromParameters(project.parameters);
    for (const bricks of Object.values(project.rows)) {
      const rects = rectangles(bricks, variant, projectGrid);
      const expected = bricks.reduce(
        (count, brick) =>
          count + brickBoxes(brick).length + Number(Boolean(notchBox(brick)) && brick.custom?.ledge !== false),
        0
      );
      expect(rects).toHaveLength(expected);
      for (const rect of rects) {
        for (const attribute of ["width", "height", "stroke-width"]) {
          expect(Number.isFinite(Number(rect[attribute]))).toBe(true);
          expect(Number(rect[attribute])).toBeGreaterThan(0);
        }
      }
    }
  });
});
