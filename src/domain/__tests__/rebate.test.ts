import { describe, expect, it } from "vitest";
import { brickBoxes, brickBounds, notchBox, overlaps, placeBricksInRow, removeBrickAt, gridFromParameters } from "../geometry";
import { DEFAULT_PARAMETERS } from "../constants";
import type { PlacedBrick } from "../types";

const grid = gridFromParameters(DEFAULT_PARAMETERS);

const rebate = (x: number, y: number, corner: PlacedBrick["notchCorner"], orientation: "h" | "v" = "h"): PlacedBrick => ({
  id: `reb-${x}-${y}-${corner}`,
  row: 1,
  x,
  y,
  kind: "rebate",
  orientation,
  notchCorner: corner
});

const standard = (x: number, y: number): PlacedBrick => ({ id: `std-${x}-${y}`, row: 1, x, y, kind: "standard", orientation: "h" });

describe("brickBoxes / notchBox", () => {
  it("decomposes a rebate brick into an L covering 3/4 of the footprint", () => {
    const brick = rebate(2, 2, "ne"); // габарит 2×1, вырез 1×0.5 в правом-верхнем углу
    const boxes = brickBoxes(brick);
    expect(boxes).toHaveLength(2);
    const area = boxes.reduce((sum, b) => sum + (b.x2 - b.x1) * (b.y2 - b.y1), 0);
    expect(area).toBeCloseTo(2 * 1 * 0.75);
    const notch = notchBox(brick)!;
    expect(notch).toEqual({ x1: 3, x2: 4, y1: 2, y2: 2.5 });
    // вырез не пересекается с занятыми боксами
    for (const box of boxes) {
      expect(box.x1 < notch.x2 && box.x2 > notch.x1 && box.y1 < notch.y2 && box.y2 > notch.y1).toBe(false);
    }
  });

  it("keeps ordinary bricks as a single full box", () => {
    expect(brickBoxes(standard(0, 0))).toEqual([brickBounds(standard(0, 0))]);
  });
});

describe("collision with the notch", () => {
  it("lets a grate rest half a cell deep in a facing rebate notch", () => {
    const brick = rebate(2, 4, "ne"); // габарит x:2..4, y:4..5; вырез x:3..4, y:4..4.5
    const grate: PlacedBrick = { id: "g", row: 1, x: 3, y: 1.5, kind: "grate", orientation: "v" }; // 2×3: x:3..5, y:1.5..4.5
    // край колосника заходит на 0.5 ячейки ровно в вырез — коллизии нет
    expect(overlaps(grate, brick)).toBe(false);
    const next = placeBricksInRow([brick], [grate], grid);
    expect(next).toHaveLength(2); // кирпич с четвертью остался, колосник сел на полку
    // а без четверти тот же кирпич колосник бы вытеснил
    const solid = { ...brick, kind: "standard" as const, notchCorner: undefined };
    expect(overlaps(grate, solid)).toBe(true);
  });

  it("allows any element to occupy the notch, and blocks the solid part", () => {
    const brick = rebate(2, 2, "ne"); // вырез x:3..4, y:2..2.5
    const inNotch: PlacedBrick = { id: "t", row: 1, x: 3, y: 2, kind: "trim", orientation: "v" }; // 0.5×... trim v = 1×0.5 → x:3..4? size v: w1 h0.5 → x:3..4,y:2..2.5 ровно вырез
    expect(overlaps(brick, inNotch)).toBe(false);
    const inSolid: PlacedBrick = { id: "s", row: 1, x: 2, y: 2, kind: "cut", orientation: "h" }; // 1×1 на занятой половине
    expect(overlaps(brick, inSolid)).toBe(true);
  });

  it("placeBricksInRow keeps the rebate brick when a piece lands in its notch", () => {
    const brick = rebate(2, 2, "ne");
    const seat: PlacedBrick = { id: "seat", row: 1, x: 3, y: 2, kind: "trim", orientation: "v" };
    const next = placeBricksInRow([brick], [seat], grid);
    expect(next).toHaveLength(2); // кирпич не «заменился», элемент сел в четверть
  });
});

describe("eraser vs notch", () => {
  it("clicking inside the notch does not delete the rebate brick, solid part does", () => {
    const brick = rebate(2, 2, "ne");
    expect(removeBrickAt([brick], 3.5, 2.25)).toHaveLength(1); // клик в вырез — мимо
    expect(removeBrickAt([brick], 2.5, 2.5)).toHaveLength(0);  // клик в тело — удалил
  });
});

describe("edge rebate (паз вдоль грани)", () => {
  it("leaves a single occupied box and a full-side notch", () => {
    const brick = rebate(0, 4, "e"); // габарит 0..2×4..5, паз x:1.5..2 во всю грань
    expect(brickBoxes(brick)).toEqual([{ x1: 0, y1: 4, x2: 1.5, y2: 5 }]);
    expect(notchBox(brick)).toEqual({ x1: 1.5, y1: 4, x2: 2, y2: 5 });
  });

  it("seats a full grate assembly: trims land exactly in facing edge notches", () => {
    // кирпичи слева и справа от проёма, пазы навстречу колоснику
    const left = [rebate(0, 4, "e"), rebate(0, 5, "e")];
    const right = [rebate(5, 4, "w"), rebate(5, 5, "w")];
    // узел «колосник + 4 подрезки» (как ставит инструмент «Колосник») в проёме
    let seq = 100;
    const assembly: PlacedBrick[] = [
      { id: "g", row: 1, x: 2, y: 4, kind: "grate", orientation: "h" },
      { id: `t${seq++}`, row: 1, x: 1.5, y: 4, kind: "trim", orientation: "h" },
      { id: `t${seq++}`, row: 1, x: 1.5, y: 5, kind: "trim", orientation: "h" },
      { id: `t${seq++}`, row: 1, x: 5, y: 4, kind: "trim", orientation: "h" },
      { id: `t${seq++}`, row: 1, x: 5, y: 5, kind: "trim", orientation: "h" }
    ];
    const existing = [...left, ...right];
    for (const piece of assembly) {
      for (const brick of existing) expect(overlaps(piece, brick)).toBe(false);
    }
    const next = placeBricksInRow(existing, assembly, grid);
    expect(next).toHaveLength(existing.length + assembly.length); // никто никого не вытеснил
  });
});

describe("plate (варочная плита)", () => {
  it("has a 5×3 footprint and rests in facing edge notches like the grate", () => {
    // проём 4 ячейки шириной (x:3..7), по бокам кирпичи с пазами навстречу
    const left = rebate(1, 4, "e");   // занято 1..2.5, паз 2.5..3
    const right = rebate(7, 4, "w");  // занято 7.5..9, паз 7..7.5
    const plate: PlacedBrick = { id: "p", row: 1, x: 2.5, y: 4, kind: "plate", orientation: "h" }; // 5×3: x:2.5..7.5
    // плита краями заходит ровно в пазы обоих кирпичей
    expect(overlaps(plate, left)).toBe(false);
    expect(overlaps(plate, right)).toBe(false);
    const next = placeBricksInRow([left, right], [plate], grid);
    expect(next).toHaveLength(3);
    // а «глухие» кирпичи без пазов плита бы вытеснила
    const solidLeft = { ...left, kind: "standard" as const, notchCorner: undefined };
    expect(overlaps(plate, solidLeft)).toBe(true);
  });
});

describe("правила размещения (не стираем молча)", () => {
  it("плита ложится ПОВЕРХ кирпичей — кладка под ней остаётся", () => {
    const bricks = [standard(3, 4), { ...standard(5, 4), id: "std2" }];
    const plate: PlacedBrick = { id: "p", row: 1, x: 3, y: 4, kind: "plate", orientation: "h" };
    const next = placeBricksInRow(bricks, [plate], grid);
    expect(next).toHaveLength(3); // ничего не стёрлось
    expect(next.filter((b) => b.kind === "standard")).toHaveLength(2);
  });

  it("две плиты внахлёст — отказ", () => {
    const plate1: PlacedBrick = { id: "p1", row: 1, x: 1, y: 4, kind: "plate", orientation: "h" };
    const plate2: PlacedBrick = { id: "p2", row: 1, x: 3, y: 4, kind: "plate", orientation: "h" };
    const next = placeBricksInRow([plate1], [plate2], grid);
    expect(next).toEqual([plate1]);
  });

  it("сборка колосника на занятое место — отказ, ничего не удалено", () => {
    const occupied = [standard(2, 4)];
    let seq = 0;
    const assembly: PlacedBrick[] = [
      { id: "g", row: 1, x: 2, y: 4, kind: "grate", orientation: "h" },
      { id: `t${seq++}`, row: 1, x: 1.5, y: 4, kind: "trim", orientation: "h" }
    ];
    const next = placeBricksInRow(occupied, assembly, grid);
    expect(next).toBe(occupied); // no-op
  });

  it("одиночный кирпич по-прежнему заменяет занятое место, но не плиту", () => {
    const plate: PlacedBrick = { id: "p", row: 1, x: 2, y: 4, kind: "plate", orientation: "h" };
    const bricks = [standard(3, 4), plate];
    const draft = { ...standard(3, 4), id: "new" };
    const next = placeBricksInRow(bricks, [draft], grid);
    expect(next.map((b) => b.id).sort()).toEqual(["new", "p"]);
  });

  it("ластик над плитой снимает плиту, кирпич под ней цел", () => {
    const plate: PlacedBrick = { id: "p", row: 1, x: 3, y: 4, kind: "plate", orientation: "h" };
    const bricks = [standard(3, 4), plate];
    const afterFirst = removeBrickAt(bricks, 3.5, 4.5);
    expect(afterFirst.map((b) => b.id)).toEqual([bricks[0].id]); // плита снята
    expect(removeBrickAt(afterFirst, 3.5, 4.5)).toHaveLength(0); // второй клик — кирпич
  });
});

describe("custom brick (резак)", () => {
  const spec = { name: "тест", w: 1.6, h: 0.8, notch: { x1: 0.8, y1: 0, x2: 1.6, y2: 0.4 }, ledge: true };
  const custom = (x: number, y: number, orientation: "h" | "v" = "h"): PlacedBrick =>
    ({ id: "c1", row: 1, x, y, kind: "custom", orientation, custom: spec });

  it("bounds учитывают размер из резака и ориентацию", () => {
    expect(brickBounds(custom(2, 3))).toEqual({ x1: 2, y1: 3, x2: 3.6, y2: 3.8 });
    expect(brickBounds(custom(2, 3, "v"))).toEqual({ x1: 2, y1: 3, x2: 2.8, y2: 4.6 });
  });

  it("вырез поворачивается вместе с кирпичом", () => {
    expect(notchBox(custom(0, 0))).toEqual({ x1: 0.8, y1: 0, x2: 1.6, y2: 0.4 });
    // поворот на 90° по часовой: (x, y) → (h − y, x)
    expect(notchBox(custom(0, 0, "v"))).toEqual({ x1: 0.4, y1: 0.8, x2: 0.8, y2: 1.6 });
  });

  it("занятая площадь = габарит минус вырез, элемент садится в вырез", () => {
    const brick = custom(0, 0);
    const boxes = brickBoxes(brick);
    const area = boxes.reduce((s, b) => s + (b.x2 - b.x1) * (b.y2 - b.y1), 0);
    expect(area).toBeCloseTo(1.6 * 0.8 - 0.8 * 0.4);
    const seat: PlacedBrick = { id: "s", row: 1, x: 0.8, y: 0, kind: "trim", orientation: "v" }; // 1×0.5... x:0.8..1.8? trim v = w1 h0.5
    // элемент ровно в вырезе (0.8..1.6 × 0..0.4): возьмём кастомную вставку
    const insert: PlacedBrick = { id: "i", row: 1, x: 0.8, y: 0, kind: "custom", orientation: "h", custom: { name: "вставка", w: 0.8, h: 0.4, notch: null } };
    expect(overlaps(brick, insert)).toBe(false);
    expect(overlaps(brick, { ...insert, x: 0.4 })).toBe(true); // сдвинут на тело — конфликт
    void seat;
  });
});

describe("plate size (настраиваемый размер)", () => {
  it("footprintSizeOf берёт габарит из custom у любого элемента", () => {
    const spec = { name: "Плита 410×340", w: 410 / 125, h: 340 / 125, notch: null };
    const plate: PlacedBrick = { id: "p", row: 1, x: 0, y: 0, kind: "plate", orientation: "h", custom: spec };
    const b = brickBounds(plate);
    expect(b.x2).toBeCloseTo(410 / 125);
    expect(b.y2).toBeCloseTo(340 / 125);
    const rotated = brickBounds({ ...plate, orientation: "v" });
    expect(rotated.x2).toBeCloseTo(340 / 125);
    // старые плиты без custom — типовой габарит 5×3
    expect(brickBounds({ ...plate, custom: undefined }).x2).toBe(5);
  });
});

describe("door size (дверцы с размерами)", () => {
  it("дверца несёт ширину в плане и высоту в мм, ориентация поворачивает след", () => {
    const spec = { name: "Дверца 250×210", w: 2, h: 1, notch: null, heightMm: 210 };
    const door: PlacedBrick = { id: "d", row: 1, x: 0, y: 0, kind: "cleanout", orientation: "h", custom: spec };
    expect(brickBounds(door)).toEqual({ x1: 0, y1: 0, x2: 2, y2: 1 });
    expect(brickBounds({ ...door, orientation: "v" })).toEqual({ x1: 0, y1: 0, x2: 1, y2: 2 });
    expect(door.custom?.heightMm).toBe(210);
    // старая дверца без custom — прежний след 1×1
    expect(brickBounds({ ...door, custom: undefined })).toEqual({ x1: 0, y1: 0, x2: 1, y2: 1 });
  });
});

describe("честные 3D-коллизии по высоте", () => {
  it("дверца из нижнего ряда блокирует объём над собой через ряды", async () => {
    const { placeBricksInRows, overlaps3D } = await import("../geometry");
    const door: PlacedBrick = { id: "door", row: 1, x: 2, y: 4, kind: "cleanout", orientation: "h", custom: { name: "ДТ", w: 2, h: 1, notch: null, heightMm: 210 } };
    const over = (row: number): PlacedBrick => ({ id: `b${row}`, row, x: 2, y: 4, kind: "standard", orientation: "h" });
    expect(overlaps3D(over(2), door)).toBe(true);  // 70..135 ∩ 0..210
    expect(overlaps3D(over(3), door)).toBe(true);  // 140..205 ∩ 0..210
    expect(overlaps3D(over(4), door)).toBe(false); // 210..275 — касание, свободно
    const rows = { 1: [door] };
    expect(placeBricksInRows(rows, 2, [over(2)], grid)).toBeNull();   // чужой ряд не трогаем — отказ
    expect(placeBricksInRows(rows, 4, [over(4)], grid)).not.toBeNull();
  });

  it("колосник садится только в достаточно глубокий вырез", async () => {
    const { overlaps3D } = await import("../geometry");
    const shelf = (depth: number): PlacedBrick => ({
      id: `r${depth}`, row: 1, x: 2, y: 4, kind: "custom", orientation: "h",
      custom: { name: "паз", w: 2, h: 1, notch: { x1: 1.5, y1: 0, x2: 2, y2: 1 }, ledge: true, notchDepthMm: depth }
    });
    // колосник краем в пазу: x 3.5..5.5 → зона выреза 3.5..4
    const grate: PlacedBrick = { id: "g", row: 1, x: 3.5, y: 4, kind: "grate", orientation: "h" };
    expect(overlaps3D(grate, shelf(15))).toBe(true);  // полка 0..50, колосник 43..65 — мелко!
    expect(overlaps3D(grate, shelf(25))).toBe(false); // полка 0..40 — сел
  });

  it("кирпич полной высоты проходит только в сквозной вырез", async () => {
    const { overlaps3D } = await import("../geometry");
    const cut = (depth: number): PlacedBrick => ({
      id: `c${depth}`, row: 1, x: 2, y: 4, kind: "custom", orientation: "h",
      custom: { name: "в", w: 2, h: 1, notch: { x1: 1, y1: 0, x2: 2, y2: 0.5 }, notchDepthMm: depth }
    });
    const insert: PlacedBrick = { id: "i", row: 1, x: 3, y: 4, kind: "custom", orientation: "h", custom: { name: "вст", w: 1, h: 0.5, notch: null } };
    expect(overlaps3D(insert, cut(35))).toBe(true);  // полка мешает
    expect(overlaps3D(insert, cut(65))).toBe(false); // насквозь — влезает
  });

  it("плита над рядом не пересекается по высоте даже с кирпичом под собой", async () => {
    const { overlaps3D } = await import("../geometry");
    const plate: PlacedBrick = { id: "p", row: 1, x: 2, y: 4, kind: "plate", orientation: "h" };
    expect(overlaps3D(plate, standard(2, 4))).toBe(false);
    const plateAbove: PlacedBrick = { id: "p2", row: 2, x: 2, y: 4, kind: "plate", orientation: "h" };
    expect(overlaps3D(plate, plateAbove)).toBe(false); // 65..79 vs 135..149
  });
});

describe("плита заподлицо (flush) ложится в вырезы", () => {
  const flushPlate = (t: number): PlacedBrick => ({
    id: "fp", row: 1, x: 2.5, y: 4, kind: "plate", orientation: "h",
    custom: { name: "Плита", w: 5, h: 3, notch: null, thicknessMm: t, flush: true }
  });
  const shelf = (depth: number, x: number, corner: "e" | "w"): PlacedBrick => ({
    id: `sh${x}`, row: 1, x, y: 4, kind: "custom", orientation: "h",
    custom: { name: "паз", w: 2, h: 1, notch: corner === "e" ? { x1: 1.5, y1: 0, x2: 2, y2: 1 } : { x1: 0, y1: 0, x2: 0.5, y2: 1 }, ledge: true, notchDepthMm: depth }
  });

  it("садится в достаточно глубокие вырезы, мелкие — отказ", async () => {
    const { overlaps3D } = await import("../geometry");
    // плита 15 мм: полка выреза 20 мм → верх полки 45 < низ плиты 50 — садится
    expect(overlaps3D(flushPlate(15), shelf(20, 1, "e"))).toBe(false);
    // вырез 10 мм (полка 55) мельче толщины 15 — конфликт
    expect(overlaps3D(flushPlate(15), shelf(10, 1, "e"))).toBe(true);
    // полнотелый кирпич под краем плиты — конфликт
    expect(overlaps3D(flushPlate(15), standard(1, 4))).toBe(true);
  });

  it("накладная плита по-прежнему не конфликтует с кладкой", async () => {
    const { overlaps3D } = await import("../geometry");
    const onTop: PlacedBrick = { ...flushPlate(15), custom: { ...flushPlate(15).custom!, flush: false } };
    expect(overlaps3D(onTop, standard(3, 4))).toBe(false);
  });

  it("плита никогда не заменяет кирпичи: конфликт — отказ", async () => {
    const { placeBricksInRows } = await import("../geometry");
    const rows = { 1: [standard(3, 4)] };
    expect(placeBricksInRows(rows, 1, [flushPlate(15)], grid)).toBeNull();
    const seated = { 1: [shelf(20, 0.5, "e"), shelf(20, 7.5, "w")] };
    expect(placeBricksInRows(seated, 1, [flushPlate(15)], grid)).not.toBeNull();
  });
});
