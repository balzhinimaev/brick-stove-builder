import { COLORS } from "../theme/colors";
import type { BrickKind, Orientation, PlacedBrick, ReadyProject } from "./types";

function makeBrick(id: string, row: number, x: number, y: number, kind: BrickKind = "standard", orientation: Orientation = "h"): PlacedBrick {
  return { id, row, x, y, kind, orientation };
}

export function makeDemoRows(): Record<number, PlacedBrick[]> {
  return {
    1: [
      { id: "r1-0", row: 1, x: 1, y: 1, kind: "standard", orientation: "h" },
      { id: "r1-1", row: 1, x: 3, y: 1, kind: "standard", orientation: "h" },
      { id: "r1-2", row: 1, x: 5, y: 1, kind: "standard", orientation: "h" },
      { id: "r1-3", row: 1, x: 1, y: 4, kind: "standard", orientation: "h" },
      { id: "r1-4", row: 1, x: 3, y: 4, kind: "standard", orientation: "h" },
      { id: "r1-5", row: 1, x: 5, y: 4, kind: "standard", orientation: "h" },
      { id: "r1-6", row: 1, x: 1, y: 2, kind: "standard", orientation: "v" },
      { id: "r1-7", row: 1, x: 6, y: 2, kind: "standard", orientation: "v" },
      { id: "r1-8", row: 1, x: 3, y: 2, kind: "vent", orientation: "h" }
    ],
    2: [
      { id: "r2-0", row: 2, x: 1, y: 1, kind: "standard", orientation: "v" },
      { id: "r2-1", row: 2, x: 6, y: 1, kind: "standard", orientation: "v" },
      { id: "r2-2", row: 2, x: 2, y: 1, kind: "firebrick", orientation: "h" },
      { id: "r2-3", row: 2, x: 4, y: 1, kind: "firebrick", orientation: "h" },
      { id: "r2-4", row: 2, x: 2, y: 4, kind: "standard", orientation: "h" },
      { id: "r2-5", row: 2, x: 4, y: 4, kind: "cleanout", orientation: "h" }
    ]
  };
}

function frameCourse(prefix: string, row: number, rightCell: number, sideRight: number, bottom: number): PlacedBrick[] {
  const items: PlacedBrick[] = [];
  let index = 0;
  const id = (part: string) => `${prefix}${row}-${part}-${index++}`;
  const left = 1;
  const top = 1;

  if (row % 2 === 1) {
    for (let x = left; x <= rightCell - 1; x += 2) items.push(makeBrick(id("top"), row, x, top));
    for (let x = left; x <= rightCell - 1; x += 2) items.push(makeBrick(id("bottom"), row, x, bottom));
  } else {
    items.push(makeBrick(id("top-cut-l"), row, left, top, "cut"));
    items.push(makeBrick(id("bottom-cut-l"), row, left, bottom, "cut"));
    for (let x = left + 1; x <= rightCell - 2; x += 2) items.push(makeBrick(id("top"), row, x, top));
    for (let x = left + 1; x <= rightCell - 2; x += 2) items.push(makeBrick(id("bottom"), row, x, bottom));
    items.push(makeBrick(id("top-cut-r"), row, rightCell, top, "cut"));
    items.push(makeBrick(id("bottom-cut-r"), row, rightCell, bottom, "cut"));
  }

  for (let y = row % 2 === 1 ? top + 2 : top + 1; y <= bottom - 2; y += 2) {
    items.push(makeBrick(id("left"), row, left, y, "standard", "v"));
    items.push(makeBrick(id("right"), row, sideRight, y, "standard", "v"));
  }

  return items;
}

function makeCompactHeaterRows(): Record<number, PlacedBrick[]> {
  const inside: Record<number, PlacedBrick[]> = {
    1: [makeBrick("h1-fire-l", 1, 3, 3, "firebrick"), makeBrick("h1-fire-r", 1, 5, 3, "firebrick"), makeBrick("h1-vent-a", 1, 4, 6, "vent"), makeBrick("h1-vent-b", 1, 5, 8, "vent")],
    2: [makeBrick("h2-fire-l", 2, 3, 3, "firebrick"), makeBrick("h2-fire-r", 2, 5, 3, "firebrick"), makeBrick("h2-clean", 2, 4, 5, "cleanout"), makeBrick("h2-vent", 2, 6, 7, "vent"), makeBrick("h2-bridge", 2, 3, 9)],
    3: [makeBrick("h3-fire-l", 3, 3, 4, "firebrick"), makeBrick("h3-fire-r", 3, 5, 4, "firebrick"), makeBrick("h3-vent-a", 3, 3, 7, "vent"), makeBrick("h3-vent-b", 3, 6, 7, "vent")],
    4: [makeBrick("h4-fire", 4, 4, 3, "firebrick"), makeBrick("h4-baffle-a", 4, 3, 6), makeBrick("h4-vent", 4, 6, 8, "vent")],
    5: [makeBrick("h5-fire-l", 5, 3, 3, "firebrick"), makeBrick("h5-fire-r", 5, 5, 3, "firebrick"), makeBrick("h5-vent-a", 5, 4, 6, "vent"), makeBrick("h5-baffle", 5, 5, 8)],
    6: [makeBrick("h6-baffle-a", 6, 3, 4), makeBrick("h6-baffle-b", 6, 5, 4), makeBrick("h6-vent-a", 6, 3, 7, "vent"), makeBrick("h6-vent-b", 6, 6, 7, "vent")],
    7: [makeBrick("h7-baffle", 7, 4, 4), makeBrick("h7-vent-a", 7, 4, 6, "vent"), makeBrick("h7-vent-b", 7, 5, 8, "vent")],
    8: [makeBrick("h8-cap-a", 8, 3, 4), makeBrick("h8-cap-b", 8, 5, 4), makeBrick("h8-vent", 8, 4, 7, "vent")]
  };

  return Object.fromEntries(
    Array.from({ length: 8 }, (_, index) => {
      const row = index + 1;
      return [row, [...frameCourse("h", row, 8, 8, 11), ...(inside[row] ?? [])]];
    })
  ) as Record<number, PlacedBrick[]>;
}

function makeCookStoveRows(): Record<number, PlacedBrick[]> {
  const inside: Record<number, PlacedBrick[]> = {
    1: [makeBrick("c1-fire-a", 1, 3, 3, "firebrick"), makeBrick("c1-fire-b", 1, 5, 3, "firebrick"), makeBrick("c1-fire-c", 1, 7, 3, "firebrick"), makeBrick("c1-vent", 1, 6, 8, "vent")],
    2: [makeBrick("c2-fire-a", 2, 3, 3, "firebrick"), makeBrick("c2-fire-b", 2, 5, 3, "firebrick"), makeBrick("c2-clean", 2, 7, 5, "cleanout"), makeBrick("c2-vent-a", 2, 4, 8, "vent"), makeBrick("c2-vent-b", 2, 7, 8, "vent")],
    3: [makeBrick("c3-fire-a", 3, 3, 4, "firebrick"), makeBrick("c3-fire-b", 3, 5, 4, "firebrick"), makeBrick("c3-fire-c", 3, 7, 4, "firebrick"), makeBrick("c3-clean", 3, 2, 7, "cleanout"), makeBrick("c3-vent", 3, 6, 9, "vent")],
    4: [makeBrick("c4-fire-a", 4, 4, 3, "firebrick"), makeBrick("c4-fire-b", 4, 6, 3, "firebrick"), makeBrick("c4-baffle-a", 4, 3, 7), makeBrick("c4-vent", 4, 7, 8, "vent")],
    5: [makeBrick("c5-fire-a", 5, 3, 3, "firebrick"), makeBrick("c5-fire-b", 5, 5, 3, "firebrick"), makeBrick("c5-fire-c", 5, 7, 3, "firebrick"), makeBrick("c5-vent-a", 5, 4, 8, "vent"), makeBrick("c5-vent-b", 5, 7, 9, "vent")],
    6: [makeBrick("c6-baffle-a", 6, 3, 4), makeBrick("c6-baffle-b", 6, 5, 4), makeBrick("c6-baffle-c", 6, 7, 4), makeBrick("c6-vent-a", 6, 5, 7, "vent"), makeBrick("c6-vent-b", 6, 7, 7, "vent")],
    7: [makeBrick("c7-baffle-a", 7, 4, 4), makeBrick("c7-baffle-b", 7, 6, 4), makeBrick("c7-vent-a", 7, 4, 7, "vent"), makeBrick("c7-vent-b", 7, 7, 7, "vent")],
    8: [makeBrick("c8-cap-a", 8, 3, 4), makeBrick("c8-cap-b", 8, 5, 4), makeBrick("c8-cap-c", 8, 7, 4), makeBrick("c8-vent", 8, 6, 8, "vent")]
  };

  return Object.fromEntries(
    Array.from({ length: 8 }, (_, index) => {
      const row = index + 1;
      return [row, [...frameCourse("c", row, 10, 9, 12), ...(inside[row] ?? [])]];
    })
  ) as Record<number, PlacedBrick[]>;
}

export const READY_PROJECTS: ReadyProject[] = [
  {
    id: "compact-heater",
    title: { ru: "Компактная отопительная", en: "Compact heater", lt: "Kompaktiška šildymo" },
    subtitle: { ru: "Небольшая канальная печь с шамотной топкой и центральным дымовым ходом.", en: "Small channel heater with a firebrick firebox and central flue path.", lt: "Maža kanalų krosnis su šamotine pakura ir centriniu dūmtakiu." },
    parameters: { foundationWidth: 120, foundationLength: 160, foundationThickness: 25, roomHeight: 260 },
    rowCount: 8,
    lockedRows: [1, 2, 3, 4, 5, 6, 7, 8],
    rows: makeCompactHeaterRows(),
    accent: COLORS.brickRed
  },
  {
    id: "cook-stove-channel",
    title: { ru: "Варочно-отопительная с каналами", en: "Cooking heater with channels", lt: "Virimo-šildymo su kanalais" },
    subtitle: { ru: "Более широкая схема: топочная зона, прочистка и разнесённые вертикальные каналы.", en: "Wider layout with firebox zone, cleanout and separated vertical channels.", lt: "Platesnis maketas su pakura, valymo durelėmis ir atskirais kanalais." },
    parameters: { foundationWidth: 140, foundationLength: 180, foundationThickness: 28, roomHeight: 275 },
    rowCount: 8,
    lockedRows: [1, 2, 3, 4, 5, 6, 7, 8],
    rows: makeCookStoveRows(),
    accent: COLORS.sageDark
  }
];
