import { it, expect } from "vitest";
import { makeTeplushka15 } from "../teplushka15";
import { teplushkaVolume } from "./helpers/teplushkaVolume";
it("bounds the winter gas spaces without a prescribed allowed-cell graph", () => {
  const v = teplushkaVolume([...Object.values(makeTeplushka15().rows).flat(), plug(120, 120, 140, 260, 34)]);
  const f = v.flood(950, 650, 550);
  expect({
    upper: f.reaches(650, 900, 900),
    lower: f.reaches(650, 1100, 350),
    pipe: f.reaches(200, 200, 500),
    room: f.reaches(-50, 650, 900)
  }).toEqual({ upper: true, lower: true, pipe: true, room: false });
});
import { TEPLUSHKA_SOURCE } from "../teplushkaSource";
import type { PlacedBrick } from "../types";
const plug = (x: number, y: number, w: number, h: number, row: number): PlacedBrick => ({
  id: `test-plug-${x}-${y}-${row}`,
  kind: "custom",
  orientation: "h",
  x: (125 + x) / 125,
  y: (125 + y) / 125,
  row,
  custom: { name: "Negative-test physical plug", w: w / 125, h: h / 125 }
});
it("closed summer bypass cannot skip all six hearth descents", () => {
  const bricks = Object.values(makeTeplushka15().rows).flat();
  const plugs = TEPLUSHKA_SOURCE.downports.flatMap((p) => [10, 11].map((row) => plug(p.x, p.y, p.w, p.h, row)));
  const f = teplushkaVolume([...bricks, ...plugs]).flood(650, 900, 900);
  expect({ lower: f.reaches(650, 1100, 350), pipe: f.reaches(200, 200, 500) }).toEqual({ lower: false, pipe: false });
});
it("closing the shared 26×26 rising throat cuts both firing nodes off from the upper bell", () => {
  const bricks = Object.values(makeTeplushka15().rows).flat();
  const f = teplushkaVolume([...bricks, ...[10, 11, 12].map((row) => plug(840, 530, 260, 260, row))]).flood(
    950,
    650,
    550
  );
  expect(f.reaches(650, 900, 900)).toBe(false);
});
it("each source descent remains physically open through BOTH hearth courses", () => {
  const v = teplushkaVolume([...Object.values(makeTeplushka15().rows).flat(), plug(120, 120, 140, 260, 34)]);
  for (const p of TEPLUSHKA_SOURCE.downports)
    for (const z of [635, 695, 705, 765])
      for (let x = p.x + 15; x < p.x + p.w - 10; x += 20)
        for (let y = p.y + 15; y < p.y + p.h - 10; y += 20)
          expect(v.solid(x, y, z), `${p.id} ${x},${y},${z}`).toBe(false);
});
it("both low admissions are required as a class, not a top-mounted chimney hood", () => {
  const bricks = Object.values(makeTeplushka15().rows).flat();
  const plugs = [2, 3, 4].flatMap((row) => [plug(120, 380, 220, 130, row), plug(340, 210, 120, 130, row)]);
  const f = teplushkaVolume([...bricks, ...plugs]).flood(650, 1100, 350);
  expect(f.reaches(200, 200, 500)).toBe(false);
});
it("each removable low cleanout reaches the lower bell and is sealed during firing", () => {
  const bricks = Object.values(makeTeplushka15().rows).flat();
  const closed = teplushkaVolume([...bricks, plug(120, 120, 140, 260, 34)]).flood(650, 1100, 350);
  expect(closed.reaches(-50, 800, 100)).toBe(false);
  for (const id of ["cleanout-left-1", "cleanout-left-2"]) {
    const f = teplushkaVolume([...bricks, plug(120, 120, 140, 260, 34)], [id]).flood(650, 1100, 350);
    expect(f.reaches(-50, 800, 100), id).toBe(true);
  }
});
it("the physical summer seat connects to the shaft when its blade slides open, independently of all six descents", () => {
  const bricks = Object.values(makeTeplushka15().rows).flat();
  const plugs = TEPLUSHKA_SOURCE.downports.flatMap((p) => [10, 11].map((row) => plug(p.x, p.y, p.w, p.h, row)));
  for (const b of bricks) if (b.id === "teplushka-summer-damper") b.damperOpen = 1;
  const f = teplushkaVolume([...bricks, ...plugs, plug(120, 120, 140, 260, 34)]).flood(650, 900, 900);
  expect(f.reaches(200, 200, 500)).toBe(true);
});
it("the independent hood seat joins ABOVE the main closure, not below it", () => {
  const bricks = Object.values(makeTeplushka15().rows).flat();
  const cap = plug(120, 120, 140, 260, 34);
  for (const b of bricks) if (b.id === "teplushka-main-damper") b.damperOpen = 0;
  const closed = teplushkaVolume([...bricks, cap]).flood(650, 250, 1100);
  expect(closed.reaches(200, 200, 1900)).toBe(false);
  for (const b of bricks) if (b.id === "teplushka-hood-damper") b.damperOpen = 1;
  const hood = teplushkaVolume([...bricks, cap]).flood(650, 250, 1100);
  expect(hood.reaches(200, 200, 1900)).toBe(true);
  expect(hood.reaches(200, 200, 1400)).toBe(false);
});
it("main exhaust with a test cap has no external shortcut through the hood, plate, mouth or cleanouts", () => {
  const bricks = Object.values(makeTeplushka15().rows).flat();
  const cap = plug(120, 120, 140, 260, 34);
  const f = teplushkaVolume([...bricks, cap]).flood(950, 650, 550);
  expect(f.reaches(200, 200, 2250)).toBe(true);
  expect(f.reaches(-50, 800, 900)).toBe(false);
});

it("preserves the whole 260×260 rising throat in course 12, including the front-wall overlap", () => {
  const v = teplushkaVolume([...Object.values(makeTeplushka15().rows).flat(), plug(120, 120, 140, 260, 34)]);
  for (let x = 855; x < 1090; x += 20)
    for (let y = 545; y < 780; y += 20)
      for (const z of [775, 805, 825]) expect(v.solid(x, y, z), `${x},${y},${z}`).toBe(false);
});

it("retains summer frame at half/full opening with no exterior escape and no required lower-bell path", () => {
  for (const opening of [0.5, 1]) {
    const bricks = Object.values(makeTeplushka15().rows).flat();
    for (const b of bricks) if (b.id === "teplushka-summer-damper") b.damperOpen = opening;
    const plugs = TEPLUSHKA_SOURCE.downports.flatMap((p) => [10, 11].map((row) => plug(p.x, p.y, p.w, p.h, row)));
    const f = teplushkaVolume([...bricks, ...plugs, plug(120, 120, 140, 260, 34)]).flood(650, 900, 900);
    expect(f.reaches(200, 200, 1900)).toBe(true);
    expect(f.reaches(-50, 800, 900)).toBe(false);
  }
});

it("the closed main blade isolates the above-view shaft from the lower combustion network", () => {
  const bricks = Object.values(makeTeplushka15().rows).flat();
  for (const b of bricks) if (b.id === "teplushka-main-damper") b.damperOpen = 0;
  const f = teplushkaVolume([...bricks, plug(120, 120, 140, 260, 34)]).flood(950, 650, 550);
  expect(f.reaches(200, 200, 1400)).toBe(true);
  expect(f.reaches(200, 200, 1900)).toBe(false);
  expect(f.reaches(-50, 800, 900)).toBe(false);
});
