import type { BrickKind, PlacedBrick, ReadyProject } from "./types";

/** Architectural teaching model, not a construction order or calculated flue design. */
export function makeRussianStove(): ReadyProject {
  const rows: Record<number, PlacedBrick[]> = {};
  let sequence = 0;
  const add = (row: number, x: number, y: number, kind: BrickKind, extra: Partial<PlacedBrick> = {}) => {
    rows[row] ??= [];
    rows[row].push({ id: `russian-${sequence++}`, row, x, y, kind, orientation: "h", ...extra });
  };
  // Tile a cell mask with staggered joints. Every cell is consumed exactly once.
  const tile = (row: number, mask: (x: number, y: number) => boolean, kind: BrickKind = "standard") => {
    for (let y = 1; y < 17; y++) {
      for (let x = 1; x < 13; ) {
        if (!mask(x, y)) {
          x++;
          continue;
        }
        const pair = mask(x + 1, y) && x + 1 < 13 && (x + row + y) % 2 === 0;
        add(
          row,
          x,
          y,
          pair ? kind : kind === "firebrick" ? "custom" : "cut",
          !pair && kind === "firebrick"
            ? {
                custom: { name: "Половинка шамота", w: 1, h: 1, cutFrom: "firebrick" }
              }
            : {}
        );
        x += pair ? 2 : 1;
      }
    }
  };
  const half = (row: number, x: number, y: number, kind: BrickKind = "standard") =>
    add(
      row,
      x,
      y,
      kind === "firebrick" ? "custom" : "cut",
      kind === "firebrick" ? { custom: { name: "Половинка шамота", w: 1, h: 1, cutFrom: "firebrick" } } : {}
    );

  for (let row = 1; row <= 2; row++) tile(row, () => true);
  // A solid lower body is intentional: the engine has no inclined arch bricks.
  // Do not suspend the hearth over an unmodelled underoven vault.
  for (let row = 3; row <= 11; row++) {
    tile(
      row,
      (x, y) =>
        y < 12 ||
        (y >= 12 &&
          (x < 4 || x >= 10) &&
          !(row >= 10 && ((x === 11 && (y === 13 || y === 14)) || (x === 10 && y === 13))))
    );
  }
  // Separate cooking firebox with a side outlet into its own enclosed riser.
  for (let row = 3; row <= 12; row++) {
    if (row === 3) {
      tile(row, (x, y) => x >= 4 && x < 10 && y >= 12 && y < 16);
      continue;
    }
    const seat = row === 12;
    const edge = (x: number, y: number, orientation: "h" | "v", notchCorner: PlacedBrick["notchCorner"]) =>
      add(row, x, y, seat ? "rebate" : "firebrick", {
        orientation,
        ...(seat
          ? {
              notchCorner,
              custom: { name: "Посадка плиты", w: 2, h: 1, notchDepthMm: 15, cutFrom: "firebrick" as const }
            }
          : {})
      });
    for (const x of [4, 6, 8]) edge(x, 12, "h", "s");
    edge(4, 13, "v", "e");
    if (row === 10 || row === 11) half(row, 9, 14, "firebrick");
    else edge(9, 13, "v", "w");
    if (row === 10) {
      // The lintel overlaps both jambs; it does not rest on the metal door.
      half(row, 4, 15, "firebrick");
      edge(5, 15, "h", "n");
      edge(7, 15, "h", "n");
      half(row, 9, 15, "firebrick");
    } else {
      edge(4, 15, "h", "n");
      edge(8, 15, "h", "n");
      if (row >= 11) edge(6, 15, "h", "n");
    }
    if (row === 4 || row === 6)
      add(row, 6, 15, "cleanout", {
        custom: {
          name: row === 4 ? "Поддувальная дверца" : "Топочная дверца",
          w: 2,
          h: 1,
          heightMm: row === 4 ? 140 : 280
        }
      });
    if (row === 4) {
      for (const x of [5, 8]) add(row, x, 13, "firebrick", { orientation: "v" });
    }
    if (row === 5) {
      for (const x of [5, 8])
        add(row, x, 13, "rebate", {
          orientation: "v",
          notchCorner: x === 5 ? "e" : "w",
          custom: { name: "Опора колосника", w: 2, h: 1, notchDepthMm: 22, cutFrom: "firebrick" }
        });
      add(row, 5.5, 13, "grate", { custom: { name: "Колосник 375×250", w: 3, h: 2, thicknessMm: 22, seatZMm: 43 } });
    }
    if (seat)
      add(row, 4.5, 12.5, "plate", {
        custom: { name: "Плита 625×375×15", w: 5, h: 3, thicknessMm: 15, flush: true, seatZMm: 50 }
      });
  }
  tile(12, (_x, y) => y < 12, "firebrick");

  // Full-height masonry carries the hood. The right jamb is also the inner
  // wall of the hob riser (x11, y13–14); none of it bears on the hotplate.
  for (let row = 12; row <= 20; row++) {
    for (let y = 12; y <= 14; y++) {
      half(row, 3, y);
      if (row !== 12 || y === 14) half(row, 10, y);
    }
    // The inlet head bridges the one-cell side opening from its rear jamb.
    if (row === 12) add(row, 10, 12, "standard", { orientation: "v" });
    if (row < 17) {
      half(row, 3, 15);
      half(row, 10, 15);
    } else if (row === 17) {
      add(row, 3, 15, "standard");
      add(row, 9, 15, "standard");
    } else if (row === 18) {
      half(row, 3, 15);
      add(row, 4, 15, "standard");
      add(row, 8, 15, "standard");
      half(row, 10, 15);
    } else {
      for (const x of [3, 5, 7, 9]) add(row, x, 15, "standard");
    }
  }
  for (let row = 12; row <= 21; row++) {
    for (let y = 12; y <= 15; y++) half(row, 12, y);
    half(row, 11, 12);
    half(row, 11, 15);
  }
  // Roof of the side riser: each vertical brick bridges from an end wall.
  for (const y of [12, 14]) add(22, 11, y, "standard", { orientation: "v" });
  for (let y = 12; y <= 15; y++) half(22, 12, y);

  for (let row = 13; row <= 20; row++) {
    tile(row, (x, y) => y < 11 && (x < 3 || x >= 11 || y < 3), "firebrick");
    if (row <= 18) tile(row, (x, y) => y === 11 && (x < 5 || x >= 9), "firebrick");
    else {
      const edge = row === 19 ? 4 : 5;
      tile(row, (x, y) => y === 11 && (x < edge || x >= 14 - edge), "firebrick");
      add(row, edge, 11, "firebrick");
      add(row, 12 - edge, 11, "firebrick");
    }
  }
  // The engine has no horizontal-axis rotation. These explicitly bonded
  // corbels are a schematic envelope, not a calculated self-supporting arch.
  // Unlike generic mask tiling, no half-brick is left beyond the support edge.
  for (let row = 21; row <= 24; row++) {
    const edge = row - 19;
    tile(row, (_x, y) => y < 3);
    tile(row, (x, y) => y >= 3 && y < 11 && (x < edge || x >= 14 - edge));
    for (let y = 3; y < 11; y++) {
      add(row, edge, y, "standard");
      add(row, 12 - edge, y, "standard");
    }
  }
  // Flat upper deck / schematic lie-down surface above the closed chamber.
  tile(25, (_x, y) => y < 11);

  for (let row = 21; row <= 22; row++) {
    tile(row, (x, y) => x >= 3 && x < 11 && (y === 11 || y === 15));
    for (let y = 12; y <= 14; y++) half(row, 3, y);
    if (row === 21) {
      half(row, 10, 12);
      half(row, 10, 14); // y13 is the riser-to-hood outlet.
    } else {
      add(row, 10, 12, "standard", { orientation: "v" });
      half(row, 10, 14);
    }
  }
  // Hood shoulders overlap their preceding walls before the next course
  // trims the outside. A shifted one-cell wall would otherwise float.
  tile(23, (x, y) => x >= 3 && x < 11 && y === 11);
  for (let y = 12; y <= 15; y++) {
    add(23, 3, y, "standard");
    add(23, 9, y, "standard");
  }
  for (let x = 5; x < 9; x++) add(23, x, 14, "standard", { orientation: "v" });
  tile(24, (x, y) => x >= 4 && x < 10 && y >= 11 && y < 15 && (x === 4 || x === 9 || y === 11 || y === 14));
  tile(25, (x, y) => x >= 4 && x < 10 && (y === 11 || y === 14));
  for (const y of [12, 13]) {
    add(25, 4, y, "standard");
    add(25, 8, y, "standard");
  }
  for (let row = 26; row <= 36; row++) {
    tile(row, (x, y) => x >= 5 && x < 9 && y >= 11 && y < 15 && (x === 5 || x === 8 || y === 11 || y === 14));
    if (row === 29)
      add(row, 6, 12, "damper", { damperOpen: 0.65, custom: { name: "Условная дымовая задвижка", w: 2, h: 2 } });
  }
  return {
    id: "russian-stove-hob",
    title: { ru: "Русская печь с плитой", en: "Russian stove with hob", lt: "Rusiška krosnis su virykle" },
    subtitle: {
      ru: "Демонстрационная модель, не строительная порядовка. Под, горнило и устье, условный ступенчатый свод, отдельная топка плиты, дымосборник и труба. 36 редактируемых рядов.",
      en: "Demonstration, not a construction plan. Hearth, cooking chamber and mouth, schematic stepped vault, separate hob firebox, smoke hood and chimney. 36 editable courses.",
      lt: "Demonstracinis modelis, ne statybos planas. Padas, kamera, anga, sąlyginis skliautas, viryklės pakura ir kaminas. 36 redaguojamos eilės."
    },
    parameters: { foundationWidth: 175, foundationLength: 225, foundationThickness: 25, roomHeight: 300 },
    rowCount: 36,
    lockedRows: [],
    rows,
    accent: "#A6472A"
  };
}

export const RUSSIAN_STOVE = makeRussianStove();
