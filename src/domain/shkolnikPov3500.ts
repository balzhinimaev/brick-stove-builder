import type { PlacedBrick, ReadyProject } from "./types";

type Rect = { x: number; y: number; w: number; h: number };

const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

/** Shkolnik 1991, §58, fig. 107. See docs/shkolnik-pov-3500.md. */
export function makeShkolnikPov3500(): ReadyProject {
  const rows: Record<number, PlacedBrick[]> = {};
  let sequence = 0;
  const ox = 250;
  const oy = 250;

  const emit = (row: number, area: Rect, name: string, extra: Partial<PlacedBrick> = {}) => {
    const brick: PlacedBrick = {
      id: `pov3500-${sequence++}`,
      row,
      x: (ox + area.x) / 125,
      y: (oy + area.y) / 125,
      kind: "custom",
      orientation: "h",
      custom: { name, w: area.w / 125, h: area.h / 125, cutFrom: "standard" },
      ...extra
    };
    rows[row] ??= [];
    rows[row].push(brick);
    return brick;
  };

  const subtract = (area: Rect, hole: Rect): Rect[] => {
    const x1 = Math.max(area.x, hole.x);
    const y1 = Math.max(area.y, hole.y);
    const x2 = Math.min(area.x + area.w, hole.x + hole.w);
    const y2 = Math.min(area.y + area.h, hole.y + hole.h);
    if (x2 <= x1 || y2 <= y1) return [area];
    return [
      rect(area.x, area.y, area.w, y1 - area.y),
      rect(area.x, y2, area.w, area.y + area.h - y2),
      rect(area.x, y1, x1 - area.x, y2 - y1),
      rect(x2, y1, area.x + area.w - x2, y2 - y1)
    ].filter((part) => part.w > 0.1 && part.h > 0.1);
  };

  const tile = (row: number, areas: Rect[], holes: Rect[] = [], name = "Кладка · рис. 107") => {
    for (const source of areas) {
      let parts = [source];
      for (const hole of holes) parts = parts.flatMap((part) => subtract(part, hole));
      for (const area of parts) {
        const countX = Math.ceil(area.w / (row % 2 ? 250 : 200));
        const countY = Math.ceil(area.h / 120);
        const moduleX = area.w / countX;
        const moduleY = area.h / countY;
        for (let iy = 0; iy < countY; iy++) {
          for (let ix = 0; ix < countX; ix++) {
            emit(row, rect(area.x + ix * moduleX, area.y + iy * moduleY, moduleX, moduleY), name);
          }
        }
      }
    }
  };

  const body = rect(0, 0, 1020, 770);
  const inside = rect(120, 120, 780, 530);
  const shell = (row: number, holes: Rect[] = []) => tile(row, [body], [inside, ...holes]);
  const hardware = (row: number, area: Rect, id: string, kind: PlacedBrick["kind"], heightMm: number) => {
    const brick = emit(row, area, id, {
      id: `pov3500-${id}`,
      kind,
      custom: { name: id, w: area.w / 125, h: area.h / 125, heightMm }
    });
    return brick;
  };
  const steelSupport = (row: number, area: Rect, name: string) =>
    emit(row, area, name, {
      custom: {
        name,
        w: area.w / 125,
        h: area.h / 125,
        material: "steel",
        profileXZ: [
          { x: 0, z: 65 },
          { x: area.w, z: 65 },
          { x: area.w, z: 70 },
          { x: 0, z: 70 }
        ]
      }
    });

  // 1–2: source plans show a solid, bonded foundation course.
  tile(1, [body], [], "Сплошной 1-й ряд · рис. 107");
  tile(2, [body], [], "Сплошной 2-й ряд · рис. 107");

  const ash = rect(250, 120, 270, 300);
  for (const row of [3, 4]) {
    shell(row, [rect(250, 0, 270, 120)]);
    tile(row, [inside], [ash, rect(650, 260, 130, 270)], "Низ зимнего хода · рис. 107");
  }
  steelSupport(4, rect(240, 120, 300, 40), "Полоса перекрытия зольника · положение интерполировано");
  hardware(3, rect(285, 0, 200, 120), "Поддувальная дверца 200×140", "cleanout", 140);

  // 5: перекрытие зольника, посадка решётки и нижняя чистка.
  tile(5, [inside], [rect(275, 155, 220, 270), rect(650, 260, 130, 270)], "Перекрытие зольника и полки колосника");
  shell(5, [rect(250, 0, 270, 120), rect(745, 0, 130, 120)]);
  const grate = hardware(6, rect(275, 155, 220, 270), "Колосник 220×270", "grate", 20);
  grate.custom!.thicknessMm = 20;
  hardware(5, rect(745, 0, 130, 120), "Нижняя чистка", "cleanout", 140);

  const firebox = rect(220, 110, 390, 430);
  for (let row = 6; row <= 9; row++) {
    shell(row, [rect(250, 0, 320, 120), ...(row === 6 ? [rect(745, 0, 130, 120)] : [])]);
    tile(row, [inside], [firebox, rect(650, 260, 130, 270)], "Стенки топливника и подъёмный ход");
  }
  hardware(6, rect(260, 0, 300, 120), "Топочная дверца 300×280", "cleanout", 280);

  // 10–11: перекрытие топливника и вынесенная двухконфорочная плита.
  tile(10, [body], [rect(120, 120, 780, 530), rect(90, 0, 710, 410)], "Посадочный ряд плиты · рис. 107");
  tile(10, [rect(120, 120, 780, 530)], [rect(220, 110, 510, 380), rect(90, 0, 710, 410)], "Перекрытие топливника");
  const hob = hardware(10, rect(90, 0, 710, 410), "Плита 710×410 · две конфорки", "plate", 15);
  hob.custom!.thicknessMm = 15;
  steelSupport(10, rect(800, 120, 100, 530), "Полоса под боковым подъёмным каналом · положение интерполировано");
  shell(11, [rect(90, 0, 710, 410)]);
  tile(11, [rect(800, 120, 100, 530)], [], "Основание бокового подъёмного канала");
  steelSupport(11, rect(150, 0, 680, 40), "Полоса над плитой · положение интерполировано");
  steelSupport(11, rect(120, 120, 40, 370), "Боковая полоса сушильного шкафа · положение интерполировано");
  steelSupport(11, rect(120, 490, 560, 40), "Задняя полоса сушильного шкафа · положение интерполировано");
  steelSupport(11, rect(120, 610, 560, 40), "Вторая задняя полоса сушильного шкафа · положение интерполировано");

  // 12–17: источник называет этот верхний объём сушильным шкафом 510×380.
  const dryer = rect(170, 120, 510, 380);
  for (let row = 12; row <= 16; row++) {
    shell(row, [rect(170, 0, 510, 120)]);
    tile(row, [rect(120, 120, 560, 530)], [dryer], "Обкладка сушильного шкафа");
    tile(row, [rect(800, 120, 100, 530)], [], "Стенка бокового подъёмного канала");
  }
  hardware(12, rect(170, 0, 510, 120), "Сушильный шкаф 510×380", "cleanout", 380);
  for (const y of [120, 250, 380])
    steelSupport(16, rect(150, y, 550, 40), "Полоса перекрытия сушильного шкафа · положение интерполировано");
  tile(17, [body], [rect(710, 150, 130, 430), rect(170, 0, 510, 120)], "Перекрытие сушильного шкафа");
  steelSupport(17, rect(150, 0, 550, 40), "Фасадная полоса над сушильным шкафом · положение интерполировано");

  // 18–29: mixed winter circuit reconstructed from sections A–A…Г–Г and plans 19, 23, 26, 29.
  const leftDown = rect(120, 120, 210, 530);
  const middleUp = rect(405, 120, 210, 530);
  const rightDown = rect(690, 120, 210, 530);
  for (let row = 18; row <= 21; row++) {
    shell(row);
    tile(row, [rect(330, 120, 75, 530), rect(615, 120, 75, 530)], [], "Перегородки зимнего дымооборота");
  }
  // Upper turn: left and centre communicate at row 22; cleanout/samovar are on the facade.
  tile(
    22,
    [body],
    [leftDown, middleUp, rightDown, rect(120, 500, 495, 150), rect(120, 0, 160, 120), rect(700, 0, 160, 120)],
    "Верхняя перемычка первого оборота"
  );
  hardware(22, rect(120, 0, 160, 120), "Самоварник", "cleanout", 140);
  hardware(22, rect(700, 0, 160, 120), "Верхняя чистка", "cleanout", 140);
  steelSupport(22, rect(320, 500, 390, 120), "Полоса первого оборота · положение интерполировано");
  for (let row = 23; row <= 25; row++) {
    shell(row, row === 23 ? [rect(120, 0, 160, 120), rect(700, 0, 160, 120)] : []);
    tile(
      row,
      [rect(330, 120, 75, 530), rect(615, 120, 75, 530)],
      [rect(335, 300, 5, 250)],
      "Вертикальные каналы смешанной системы"
    );
  }
  // Second turn and summer bypass saddle.
  tile(
    26,
    [body],
    [leftDown, middleUp, rightDown, rect(405, 120, 495, 150), rect(335, 300, 5, 250), rect(620, 300, 5, 250)],
    "Перемычка второго оборота"
  );
  steelSupport(26, rect(320, 120, 390, 40), "Полоса второго оборота · положение интерполировано");
  for (let row = 27; row <= 28; row++) {
    shell(row);
    tile(
      row,
      [rect(330, 120, 75, 530), rect(615, 120, 75, 530)],
      [rect(335, 300, 5, 250), rect(620, 300, 5, 250)],
      "Верх зимнего дымооборота"
    );
  }
  steelSupport(28, rect(400, 360, 210, 40), "Полоса перекрыши трубы · положение интерполировано");
  steelSupport(28, rect(400, 460, 210, 40), "Вторая полоса перекрыши трубы · положение интерполировано");
  tile(29, [body], [rect(690, 120, 210, 250)], "Перекрыша и сбор к насадной трубе");
  tile(30, [rect(650, 80, 290, 330)], [rect(720, 145, 150, 200)], "Основание насадной трубы");

  // Source labels two independent dampers for the winter and summer paths.
  for (const [row, x, id, opening] of [
    [23, 335, "Задвижка зимнего хода", 1],
    [26, 620, "Задвижка летнего хода", 0]
  ] as const) {
    const gate = hardware(row, rect(x, 300, 5, 250), id, "damper", 210);
    gate.custom!.damperPlane = "vertical";
    gate.custom!.thicknessMm = 5;
    gate.custom!.damperFrameMm = 0;
    gate.custom!.seatZMm = 0;
    gate.custom!.damperSlide = "up";
    gate.damperOpen = opening;
  }

  // Keep named source spaces discoverable in generated JSON and tests.
  void ash;
  void dryer;

  return {
    id: "shkolnik-pov-3500",
    title: {
      ru: "Отопительно-варочная печь ПОВ-3500",
      en: "POV-3500 heating and cooking stove",
      lt: "POV-3500 šildymo ir virimo krosnis"
    },
    subtitle: {
      ru: "Школьник, 1991 · §58, рис. 107. Плита на две конфорки, зимний и летний ходы, сушильный шкаф и самоварник. Промежуточные ряды реконструированы по разрезам.",
      en: "Shkolnik 1991, §58, fig. 107. Two-ring hob, winter and summer paths, drying cabinet and samovar vent. Intermediate courses are reconstructed from sections.",
      lt: "Školnikas, 1991, §58, 107 pav. Dviejų kaitviečių plokštė, kamera, žiemos ir vasaros kanalai. Tarpinės eilės atkurtos pagal pjūvius."
    },
    parameters: { foundationWidth: 140, foundationLength: 120, foundationThickness: 25, roomHeight: 270 },
    rowCount: 30,
    lockedRows: [],
    rows,
    accent: "#9A5F3F"
  };
}

export const SHKOLNIK_POV_3500 = makeShkolnikPov3500();

export const POV3500_SOURCE = {
  citation: "А. Е. Школьник, Печное отопление малоэтажных зданий, 1991, §58, рис. 107",
  bodyMm: [1020, 770, 2100] as const,
  drawnPlans: [1, 2, 4, 6, 8, 10, 11, 12, 13, 16, 17, 19, 23, 24, 25, 26, 29, 30] as const,
  interpolatedPlans: [3, 5, 7, 9, 14, 15, 18, 20, 21, 22, 27, 28] as const,
  circuits: ["winter-mixed", "summer-bypass"] as const
};
