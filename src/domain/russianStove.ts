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
  for (let row = 1; row <= 2; row++) tile(row, () => true);
  for (let row = 3; row <= 11; row++) {
    tile(
      row,
      (x, y) =>
        (y <= 10 && (x === 1 || x === 12 || y === 1)) ||
        (y === 11 && (row === 11 || x < 4 || x >= 10)) ||
        (y >= 12 && (x < 4 || x >= 10))
    );
  }
  // Separate cooking firebox: ash door, supported grate, tall fire door and flush hob.
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
    edge(9, 13, "v", "w");
    edge(4, 15, "h", "n");
    edge(8, 15, "h", "n");
    if (row >= 10) edge(6, 15, "h", "n");
    if (row === 4 || row === 6)
      add(row, 6, 15, "cleanout", {
        custom: {
          name: row === 4 ? "Поддувальная дверца" : "Топочная дверца",
          w: 2,
          h: 1,
          heightMm: row === 4 ? 140 : 280
        }
      });
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
  for (let row = 13; row <= 20; row++) {
    tile(row, (x, y) => y < 12 && (x < 3 || x >= 11 || y < 3 || (y === 11 && (x < 5 || x >= 9))), "firebrick");
  }
  // The engine cannot rotate bricks about a horizontal axis. This stepped envelope
  // illustrates a vault only; it is explicitly NOT a self-supporting masonry arch.
  for (let row = 21; row <= 25; row++) {
    const inset = row - 20;
    tile(row, (x, y) => y < 11 && (x < 3 + inset || x >= 11 - inset || y < 3));
    const left = row <= 22 ? 3 : row <= 24 ? 4 : 5;
    const right = 14 - left;
    const back = row <= 22 ? 16 : 15;
    tile(
      row,
      (x, y) =>
        x >= left && x < right && y >= 11 && y < back && (x === left || x === right - 1 || y === 11 || y === back - 1)
    );
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
