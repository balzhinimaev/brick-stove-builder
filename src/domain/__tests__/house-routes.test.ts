import { it, expect } from "vitest";
import { makeHouseRussianStove } from "../houseRussianStove";
import type { PlacedBrick } from "../types";
import { houseVolume } from "./helpers/houseVolume";
function plug(x: number, y: number, w: number, h: number, row: number, heightMm = 70): PlacedBrick {
  return {
    id: `audit-${x}-${y}-${row}`,
    kind: "cleanout",
    orientation: "h",
    x: (625 + x) / 125,
    y: (125 + y) / 125,
    row,
    custom: { name: "Test-only port cap", w: w / 125, h: h / 125, heightMm }
  };
}
function volume(gates: Record<string, number>, extra: PlacedBrick[] = []) {
  const stock = Object.values(makeHouseRussianStove().rows)
    .flat()
    .map((b) => (b.kind === "damper" ? { ...b, damperOpen: gates[b.id] ?? 0 } : b));
  // Close ONLY the room-facing service ports to test internal connectivity without an outside-air detour.
  const caps = [
    plug(0, 120, 1200, 85, 11, 560),
    plug(0, 205, 85, 315, 11, 560),
    plug(1025, 205, 175, 315, 11, 560),
    plug(-380, 270, 260, 380, 36)
  ];
  return houseVolume([...stock, ...caps, ...extra]);
}
it("connects the classical hearth through its mouth and the upper U-loop, never through the cold underoven", () => {
  const v = volume({ "rp54-upper-loop-gate": 1 });
  const f = v.flood(600, 1200, 900);
  expect({
    hood: f.reaches(600, 350, 1400),
    right: f.reaches(980, 1000, 1640),
    rear: f.reaches(600, 1780, 1640),
    left: f.reaches(220, 1000, 1640),
    pipe: f.reaches(-250, 400, 2400),
    under: f.reaches(700, 1200, 150),
    room: f.reaches(1250, 1000, 900)
  }).toEqual({ hood: true, right: true, rear: true, left: true, pipe: true, under: false, room: false });
});
it("each leg of the upper loop is necessary; no concealed direct bypass", () => {
  for (const [x, y, w, h] of [
    [880, 1200, 200, 50],
    [500, 1680, 50, 200],
    [120, 1200, 200, 50]
  ]) {
    const v = volume({ "rp54-upper-loop-gate": 1 }, [plug(x, y, w, h, 23, 280)]);
    expect(v.flood(600, 1200, 900).reaches(-250, 400, 2400), `${x},${y}`).toBe(false);
  }
}, 15000);
it("the separate hob route bypasses the gorniło, and its gate physically closes the route", () => {
  for (const open of [0, 1]) {
    const f = volume({ "rp54-hob-gate": open }).flood(900, 300, 500);
    expect({
      pipe: f.reaches(-250, 400, 2400),
      oven: f.reaches(600, 1200, 900),
      under: f.reaches(700, 1200, 150)
    }).toEqual({ pipe: !!open, oven: false, under: false });
  }
});
it("feeds the hob fire through the R6 grate from the R3 ash cavity, not around its rear or through the front header", () => {
  for (const capped of [false, true]) {
    const f = volume({ "rp54-hob-gate": 1 }, capped ? [plug(790, 120, 230, 280, 6)] : []).flood(900, 300, 180);
    expect({
      fire: f.reaches(900, 300, 500),
      pipe: f.reaches(-250, 400, 2400),
      under: f.reaches(700, 1200, 150),
      room: f.reaches(900, -60, 180)
    }).toEqual({ fire: !capped, pipe: !capped, under: false, room: false });
  }
});
it("the direct gate bypasses a plugged upper loop; closed means disconnected", () => {
  for (const open of [0, 1])
    expect(volume({ "rp54-direct-gate": open }).flood(600, 1200, 900).reaches(-250, 400, 2400)).toBe(!!open);
});

it("seals mortar beds but never fills a removed physical arch part", () => {
  const parts = Object.values(makeHouseRussianStove().rows)
    .flat()
    .filter((b) => b.custom?.name.startsWith("Арка устья · клин"));
  const middle = parts[Math.floor(parts.length / 2)];
  const p = middle.custom!.profileXZ!;
  const x = middle.x * 125 - 625 + p.reduce((sum, p) => sum + p.x, 0) / p.length;
  const y = middle.y * 125 - 125 + (middle.custom!.h * 125) / 2;
  const z = (middle.row - 1) * 70 + p.reduce((sum, p) => sum + p.z, 0) / p.length;
  expect(houseVolume(parts).solid(x, y, z)).toBe(true);
  expect(houseVolume(parts, [middle.id]).solid(x, y, z)).toBe(false);
});
