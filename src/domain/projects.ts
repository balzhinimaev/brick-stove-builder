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

/**
 * Варочная печь «до плиты»: сплошное основание, зольник с поддувальной
 * дверцей (250×140, 2 ряда), колосник, топка с топочной дверцей (250×210,
 * 3 ряда) и посадочный ряд из кирпичей с четвертями-пазами внутрь, в которые
 * ЗАПОДЛИЦО ложится варочная плита 625×375×15. Каждый элемент проходит
 * честную 3D-проверку движка (см. тест).
 */
function makeFlushPlateStoveRows(): Record<number, PlacedBrick[]> {
  const rows: Record<number, PlacedBrick[]> = {};
  let seq = 0;
  const add = (row: number, x: number, y: number, kind: BrickKind = "standard", orientation: Orientation = "h", extra: Partial<PlacedBrick> = {}) => {
    (rows[row] ??= []).push({ id: `fps${row}-${seq++}`, row, x, y, kind, orientation, ...extra });
  };

  // печь 6×4 ячейки (75×50 см): контур x1..7, y2..6; камера x2..6, y3..5
  const frame = (row: number) => {
    for (const x of [1, 3, 5]) add(row, x, 2); // задняя стенка
    add(row, 1, 3, "standard", "v"); // бока
    add(row, 6, 3, "standard", "v");
    add(row, 1, 5); // передняя стенка (проём x3..5 под дверцы)
    add(row, 5, 5);
  };

  // ряд 1: сплошное основание
  for (const y of [2, 3, 4, 5]) for (const x of [1, 3, 5]) add(1, x, y);

  // ряд 2: зольник + поддувальная дверца 250×140 (занимает ряды 2–3)
  frame(2);
  add(2, 3, 5, "cleanout", "h", { custom: { name: "Дверца 250×140", w: 2, h: 1, notch: null, heightMm: 140 } });

  // ряд 3: зольник, проём дверцы; колосник 375×250×22 лежит КРАЯМИ на двух
  // опорных кирпичах с пазами глубиной в его толщину — заподлицо и не в воздухе
  frame(3);
  const grateSeat = { name: "", w: 2, h: 1, notch: null, notchDepthMm: 22 };
  add(3, 2, 3, "rebate", "v", { notchCorner: "e", custom: grateSeat });
  add(3, 5, 3, "rebate", "v", { notchCorner: "w", custom: grateSeat });
  add(3, 2.5, 3, "grate", "h", { custom: { name: "Колосник 375×250×22", w: 3, h: 2, notch: null, thicknessMm: 22, seatZMm: 43 } });

  // ряд 4: перемычка над поддувальной + топочная дверца 250×210 (ряды 4–6)
  frame(4);
  add(4, 3, 5, "cleanout", "h", { custom: { name: "Дверца 250×210", w: 2, h: 1, notch: null, heightMm: 210 } });

  // ряды 5–6: топка, проём топочной дверцы
  frame(5);
  frame(6);

  // ряд 7: посадочный — четверти пазами внутрь, глубина реза = толщине плиты:
  // плита ложится на полки ВПЛОТНУЮ, а не парит над ними (спека в h-ориентации)
  const seat = { name: "", w: 2, h: 1, notch: null, notchDepthMm: 15 };
  for (const x of [1, 3, 5]) add(7, x, 2, "rebate", "h", { notchCorner: "s", custom: seat });
  add(7, 1, 3, "rebate", "v", { notchCorner: "e", custom: seat });
  add(7, 6, 3, "rebate", "v", { notchCorner: "w", custom: seat });
  for (const x of [1, 3, 5]) add(7, x, 5, "rebate", "h", { notchCorner: "n", custom: seat });
  add(7, 1.5, 2.5, "plate", "h", { custom: { name: "Плита 625×375×15", w: 5, h: 3, notch: null, thicknessMm: 15, flush: true } });

  return rows;
}

export const READY_PROJECTS: ReadyProject[] = [
  {
    id: "cook-plate-flush",
    title: { ru: "Варочная печь с плитой заподлицо", en: "Cook stove with flush plate", lt: "Viryklė su įleista plokšte" },
    subtitle: {
      ru: "Полный узел до плиты: поддувальная и топочная дверцы, колосник, посадочный ряд с четвертями — плита 625×375×15 утоплена вровень с кладкой.",
      en: "Complete stack up to the plate: ash and fire doors, grate, seat course with rebates — the 625×375×15 plate sits flush with the masonry.",
      lt: "Pilnas mazgas iki plokštės: durelės, grotelės ir įleista 625×375×15 plokštė."
    },
    parameters: { foundationWidth: 120, foundationLength: 160, foundationThickness: 25, roomHeight: 260 },
    rowCount: 7,
    lockedRows: [1, 2, 3, 4, 5, 6],
    rows: makeFlushPlateStoveRows(),
    accent: COLORS.brickOrange
  },
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
