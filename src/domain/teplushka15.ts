import type { PlacedBrick, ReadyProject } from "./types";
import { TEPLUSHKA_DAMPERS } from "./teplushkaControls";
import { TEPLUSHKA_SOURCE } from "./teplushkaSource";

type Rect = { x: number; y: number; w: number; h: number };
const rect = (x: number, y: number, w: number, h: number): Rect => ({
  x,
  y,
  w,
  h
});
/** All transcription coordinates are physical mm from front-left; grid conversion is at emission only. */
export function makeTeplushka15(): ReadyProject {
  const rows: Record<number, PlacedBrick[]> = {};
  let sequence = 0;
  const emit = (row: number, r: Rect, name: string, extra: Partial<PlacedBrick> = {}) => {
    const brick: PlacedBrick = {
      id: `teplushka-${sequence++}`,
      row,
      x: (125 + r.x) / 125,
      y: (125 + r.y) / 125,
      kind: "custom",
      orientation: "h",
      custom: { name, w: r.w / 125, h: r.h / 125, cutFrom: "standard" },
      ...extra
    };
    rows[row] ??= [];
    rows[row].push(brick);
    return brick;
  };
  const subtract = (a: Rect, b: Rect): Rect[] => {
    const x = Math.max(a.x, b.x),
      y = Math.max(a.y, b.y),
      right = Math.min(a.x + a.w, b.x + b.w),
      back = Math.min(a.y + a.h, b.y + b.h);
    if (right <= x || back <= y) return [a];
    return [
      rect(a.x, a.y, a.w, y - a.y),
      rect(a.x, back, a.w, a.y + a.h - back),
      rect(a.x, y, x - a.x, back - y),
      rect(right, y, a.x + a.w - right, back - y)
    ].filter((r) => r.w > 1e-6 && r.h > 1e-6);
  };
  const masonry = (row: number, areas: Rect[], holes: Rect[] = [], fire = false, bondedCuts: Rect[] = []) => {
    let occupied: Rect[] = [];
    for (const area of row % 2 ? areas : [...areas].reverse()) {
      let pieces = [area];
      for (const prior of occupied) pieces = pieces.flatMap((p) => subtract(p, prior));
      occupied.push(...pieces);
    }
    for (const hole of holes) occupied = occupied.flatMap((p) => subtract(p, hole));
    for (const cut of bondedCuts) occupied = occupied.flatMap((p) => subtract(p, cut));
    for (const cut of bondedCuts)
      emit(row, cut, `Р${row} · перевязанный тычок`, {
        custom: {
          name: `Р${row} · перевязанный тычок`,
          w: cut.w / 125,
          h: cut.h / 125,
          cutFrom: fire ? "firebrick" : "standard"
        }
      });
    for (const area of occupied) {
      // Alternating headers/stretchers and half-module starts interrupt stack
      // joints. Cuts at source void boundaries are interpolated, not traced bricks.
      const xStep = row % 2 ? 250 : 125;
      const yStep = row % 2 ? 125 : 250;
      const spans = (start: number, length: number, step: number, offset: number) => {
        const ends = [start];
        let edge = Math.floor((start - offset) / step + 1) * step + offset;
        while (edge < start + length - 1e-6) {
          if (edge > start + 1e-6) ends.push(edge);
          edge += step;
        }
        ends.push(start + length);
        return ends.slice(0, -1).map((v, i) => [v, ends[i + 1] - v]);
      };
      for (const [y, h] of spans(area.y, area.h, yStep, row % 2 ? 0 : 62.5))
        for (const [x, w] of spans(area.x, area.w, xStep, row % 2 ? 0 : 62.5)) {
          emit(row, rect(x, y, w, h), `Р${row} · интерполированная перевязка`, {
            custom: {
              name: `Р${row} · интерполированная перевязка`,
              w: w / 125,
              h: h / 125,
              cutFrom: fire ? "firebrick" : "standard"
            }
          });
        }
    }
  };
  const body = rect(0, 0, 1290, 1290);
  const pipe = (row: number) => rect(120, 120, row < 9 ? 220 : row < 20 ? 165 : row < 22 ? 220 : 140, 260);
  const down = TEPLUSHKA_SOURCE.downports.map((p) => rect(p.x, p.y, p.w, p.h));
  const main = rect(840, 120, 260, 650),
    small = rect(460, 120, 260, 410);
  const lowAdmissions = [rect(120, 380, 220, 130), rect(340, 210, 120, 130)];
  masonry(1, [body]);
  for (let row = 2; row <= 9; row++) {
    const shell = [
      rect(0, 0, 1290, 120),
      rect(0, 1170, 1290, 120),
      rect(0, 120, 120, 1050),
      rect(1170, 120, 120, 1050)
    ];
    const supports = [
      rect(260, 910, 250, 130),
      rect(260, 650, 250, 130),
      rect(320, 390, 190, 190),
      rect(260, 120, 290, 130),
      rect(720, 910, 330, 130)
    ];
    const chimney = [rect(0, 0, 460, 510)];
    const assembly =
      row <= 4 ? [rect(720, 0, 570, 790)] : row <= 7 ? [rect(340, 0, 950, 890)] : [rect(340, 0, 950, 890)];
    const holes = [
      pipe(row),
      ...(row <= 4 ? lowAdmissions : []),
      main,
      ...(row >= 5 ? [small] : []),
      ...(row >= 8 ? [rect(390, 120, 710, 650)] : [])
    ];
    // Source service openings 26 in the left wall, sealed by independently removable covers.
    if (row <= 3) holes.push(rect(0, 770, 120, 130), rect(0, 1040, 120, 130));
    if (row <= 3) holes.push(rect(840, 0, 260, 120));
    if (row >= 5 && row <= 7) holes.push(rect(840, 0, 260, 120));
    if (row >= 6 && row <= 7) holes.push(rect(460, 0, 260, 120));
    masonry(
      row,
      [...shell, ...supports, ...chimney, ...assembly, ...(row === 4 ? [small] : [])],
      holes,
      row >= 6,
      row === 4
        ? [
            rect(720, 0, 250, 120),
            rect(970, 0, 200, 120),
            ...[120, 245, 370, 495].flatMap((y) => [
              rect(460, y, 250, Math.min(125, 530 - y)),
              rect(710, y, 130, Math.min(125, 530 - y))
            ])
          ]
        : []
    );
  }
  // Hearth, including all six physical descents, common firing node and removable grate throat.
  for (const row of [10, 11])
    masonry(
      row,
      [body],
      [pipe(row), ...down, rect(390, 120, 710, 410), rect(840, 530, 260, 260)],
      true,
      [260, 520, 780].map((x) => rect(x, 1040, 130, 250))
    );
  // Source upper bell and mouth. The mouth is closed during lower-firebox firing.
  for (let row = 12; row <= 15; row++) {
    const walls = [
      rect(0, row <= 13 ? 750 : 650, 120, row <= 13 ? 540 : 640),
      rect(1170, 0, 120, 1290),
      rect(0, 1170, 1290, 120),
      rect(0, 0, 350, row <= 13 ? 750 : 650),
      rect(350, 480, 820, 120),
      ...(row <= 13 ? [rect(350, 380, 90, 150)] : [])
    ];
    const holes = [pipe(row), rect(440, 480, 350, 120), ...(row === 12 ? [rect(840, 530, 260, 260)] : [])];
    if (row <= 13) {
      // Fig.33: capped rear pocket, lateral YZ aperture on its right cheek.
      // The thin forward shoulder slot receives the opened blade.
      holes.push(rect(120, 380, 230, 280), rect(350, 530, 90, 130), rect(350, 400, 5, 130));
    }
    masonry(
      row,
      walls,
      holes,
      true,
      row === 12 ? [rect(355, 380, 85, 100), rect(355, 480, 85, 50)] : row === 14 ? [rect(350, 480, 90, 120)] : []
    );
  }
  // Close the 5 mm course-joint space above the 130 mm lateral aperture.
  const summerLintel = emit(13, rect(350, 530, 90, 130), "Летний проход · верхняя кромка");
  summerLintel.custom!.profileXZ = [
    { x: 0, z: 60 },
    { x: 90, z: 60 },
    { x: 90, z: 65 },
    { x: 0, z: 65 }
  ];
  // Curved barrel: Fig.30 G–G, R880 and 990 mm clear span. Radial joints
  // are interpolated; their actual faces are shared by adjacent individual cuts.
  const radius = 880,
    thickness = 120,
    cx = 645,
    halfSpan = 495;
  const springZ = 1050,
    centerZ = springZ - Math.sqrt(radius ** 2 - halfSpan ** 2);
  const angle = Math.asin(halfSpan / radius),
    count = 17;
  type Point = { x: number; z: number };
  const clip = (points: Point[], axis: "x" | "z", value: number, above: boolean): Point[] => {
    const out: Point[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      const ia = above ? a[axis] >= value : a[axis] <= value,
        ib = above ? b[axis] >= value : b[axis] <= value;
      if (ia) out.push(a);
      if (ia !== ib) {
        const t = (value - a[axis]) / (b[axis] - a[axis]);
        out.push({ x: a.x + t * (b.x - a.x), z: a.z + t * (b.z - a.z) });
      }
    }
    return out.filter((p, i) => !out.some((q, j) => j < i && Math.hypot(p.x - q.x, p.z - q.z) < 1e-7));
  };
  const profile = (row: number, y: number, depth: number, points: Point[], name: string) => {
    if (points.length < 3) return;
    const xmin = Math.min(...points.map((p) => p.x)),
      xmax = Math.max(...points.map((p) => p.x));
    if (xmax - xmin < 1e-6 || Math.max(...points.map((p) => p.z)) - Math.min(...points.map((p) => p.z)) < 1e-6) return;
    emit(row, rect(xmin, y, xmax - xmin, depth), name, {
      custom: {
        name,
        w: (xmax - xmin) / 125,
        h: depth / 125,
        cutFrom: "firebrick",
        profileXZ: points.map((p) => ({
          x: p.x - xmin,
          z: Math.max(0, p.z - (row - 1) * 70)
        }))
      }
    });
  };
  const outer: Point[] = [];
  for (let i = 0; i <= count; i++) {
    const a = -angle + (i * 2 * angle) / count;
    outer.push({
      x: cx + (radius + thickness) * Math.sin(a),
      z: centerZ + (radius + thickness) * Math.cos(a)
    });
  }
  for (let bay = 0; bay < 6; bay++)
    for (let i = 0; i < count; i++) {
      const a = -angle + (i * 2 * angle) / count,
        b = -angle + ((i + 1) * 2 * angle) / count;
      profile(
        16,
        600 + bay * 95,
        95,
        [
          { x: cx + radius * Math.sin(a), z: centerZ + radius * Math.cos(a) },
          { x: cx + radius * Math.sin(b), z: centerZ + radius * Math.cos(b) },
          outer[i + 1],
          outer[i]
        ],
        `Свод · R880 · пояс ${bay + 1} · клин ${i + 1}`
      );
    }
  // Founded skewbacks and spandrels clipped against the actual extrados,
  // never bounding boxes; each cut is assigned to its construction course.
  const fill: Point[][] = [
    [{ x: 0, z: 1050 }, { x: 150, z: 1050 }, outer[0], { x: 0, z: outer[0].z }],
    [{ x: 1140, z: 1050 }, { x: 1290, z: 1050 }, { x: 1290, z: outer[count].z }, outer[count]],
    [{ x: 0, z: outer[0].z }, outer[0], { x: outer[0].x, z: 1400 }, { x: 0, z: 1400 }],
    [outer[count], { x: 1290, z: outer[count].z }, { x: 1290, z: 1400 }, { x: outer[count].x, z: 1400 }],
    ...outer.slice(0, -1).map((p, i) => [p, outer[i + 1], { x: outer[i + 1].x, z: 1400 }, { x: p.x, z: 1400 }])
  ];
  for (let row = 16; row <= 20; row++)
    for (const polygon of fill) {
      const slab = clip(clip(polygon, "z", (row - 1) * 70, true), "z", (row - 1) * 70 + 65, false);
      for (let bay = 0; bay < 6; bay++)
        profile(row, 600 + bay * 95, 95, slab, `Р${row} · пята/заполнение над сводом · рис.30`);
    }
  for (let row = 16; row <= 20; row++) {
    masonry(row, [rect(0, 1170, 1290, 120), rect(0, 0, 1290, 600)], [pipe(row), rect(350, 120, 820, 360)]);
  }
  masonry(21, [body], [pipe(21), rect(380, 120, 530, 260)]);
  for (let row = 22; row <= 33; row++) {
    // Fig.33: 102,89,76,63,50 cm shoulders; top remains 14×26 cm.
    const width = row <= 24 ? 1020 : row <= 26 ? 890 : row <= 28 ? 760 : row <= 30 ? 630 : row <= 32 ? 500 : 380;
    const holes = [pipe(row)];
    if (row <= 24) holes.push(rect(380, 120, row === 24 ? 260 : width - 500, 260));
    if (row >= 25 && row <= 32) holes[0] = rect(120, 120, width - 240, 260);
    const rightInner = Math.max(...holes.map((h) => h.x + h.w));
    // Through-bonded headers tie the right cheek to front/back masonry;
    // do not partition this bearing across the unsupported void edge.
    const cheekCuts: Rect[] = [];
    for (let x = rightInner; x < width; x += 125)
      for (const y of [0, 250]) cheekCuts.push(rect(x, y, Math.min(125, width - x), 250));
    masonry(row, [rect(0, 0, width, 500)], holes, false, cheekCuts);
  }
  // Millimetre rebate for the summer frame and its forward blade pocket.
  // This is a cut in existing masonry, never an added gas-support column.
  for (const row of [11, 12, 13]) {
    const originals = [...rows[row]];
    for (const b of originals) {
      const x = b.x * 125 - 125,
        y = b.y * 125 - 125;
      const right = x + b.custom!.w * 125,
        rear = y + b.custom!.h * 125;
      const zs = b.custom?.profileXZ?.map((p) => p.z) ?? [0, 65];
      const bottom = (row - 1) * 70 + Math.min(...zs),
        top = (row - 1) * 70 + Math.max(...zs);
      const a = Math.max(x, 350),
        c = Math.min(right, 355);
      const d = Math.max(y, 380),
        e = Math.min(rear, 670);
      const lo = Math.max(bottom, 760),
        hi = Math.min(top, 910);
      if (c <= a || e <= d || hi <= lo) continue;
      rows[row] = rows[row].filter((p) => p.id !== b.id);
      for (const [xx, yy, ww, hh, zz, zzTop] of [
        [x, y, right - x, rear - y, bottom, lo],
        [x, y, right - x, rear - y, hi, top],
        [x, y, a - x, rear - y, lo, hi],
        [c, y, right - c, rear - y, lo, hi],
        [a, y, c - a, d - y, lo, hi],
        [a, e, c - a, rear - e, lo, hi]
      ]) {
        if (ww < 1e-6 || hh < 1e-6 || zzTop - zz < 1e-6) continue;
        profile(
          row,
          yy,
          hh,
          [
            { x: xx, z: zz },
            { x: xx + ww, z: zz },
            { x: xx + ww, z: zzTop },
            { x: xx, z: zzTop }
          ],
          `Р${row} · посадка летней рамки`
        );
      }
    }
  }
  // Source controls are individual elements; named IDs survive editable copies.
  const hardware = (row: number, r: Rect, id: string, kind: PlacedBrick["kind"], heightMm: number) =>
    emit(row, r, id, {
      id,
      kind,
      custom: {
        name: id,
        w: r.w / 125,
        h: r.h / 125,
        heightMm,
        cutFrom: undefined
      }
    });
  hardware(2, rect(0, 770, 120, 130), "cleanout-left-1", "cleanout", 135);
  hardware(2, rect(0, 1040, 120, 130), "cleanout-left-2", "cleanout", 135);
  hardware(2, rect(840, 0, 260, 120), "main-ash-door", "cleanout", 135);
  hardware(5, rect(840, 0, 260, 120), "main-fire-door", "cleanout", 205);
  hardware(6, rect(460, 0, 260, 120), "hob-fire-door", "cleanout", 135);
  // Removable vertical mouth plate: thin XY footprint, actual XZ closure.
  const mouth = hardware(12, rect(440, 475, 350, 5), TEPLUSHKA_DAMPERS.mouth, "damper", 280);
  mouth.custom!.damperPlane = "vertical";
  mouth.custom!.damperFrameMm = 0;
  mouth.custom!.seatZMm = 0;
  mouth.custom!.thicknessMm = 5;
  mouth.damperOpen = 0;
  hardware(4, rect(840, 120, 260, 250), "main-grate", "grate", 22);
  hardware(5, rect(460, 120, 260, 250), "hob-grate", "grate", 22);
  const plate = hardware(11, rect(390, 120, 710, 410), "source-hob-710x410", "plate", 14);
  plate.custom!.thicknessMm = 5;
  for (const [row, r, id] of [
    [11, rect(350, 520, 4, 150), TEPLUSHKA_DAMPERS.summer],
    [22, rect(110, 110, 160, 280), TEPLUSHKA_DAMPERS.main],
    [24, rect(370, 110, 280, 280), TEPLUSHKA_DAMPERS.hood]
  ] as const) {
    const gate = hardware(row, r, id, "damper", 5);
    gate.custom!.thicknessMm = 5;
    if (id === TEPLUSHKA_DAMPERS.summer) {
      gate.custom!.damperPlane = "vertical";
      gate.custom!.damperSlide = "y-negative";
      gate.custom!.damperFrameMm = 10;
      gate.custom!.heightMm = 150;
      // Outer frame surrounds the inferred clear aperture y530..660/z770..900.
      gate.custom!.seatZMm = 60;
    }
    gate.damperOpen = id === TEPLUSHKA_DAMPERS.main ? 1 : 0;
  }
  return {
    id: "russian-stove-hob",
    title: {
      ru: "Теплушка-15 · русская печь с плитой",
      en: "Teplushka-15 · Russian stove with hob",
      lt: "Tepluška-15 · rusiška krosnis su virykle"
    },
    subtitle: {
      ru: "И. С. Подгородников, 1992. 129×129 см, 33 ряда. Два колпака: верхний варочный и нижний отопительный; шесть параллельных опусков. Реконструкция на проверке.",
      en: "I. S. Podgorodnikov, 1992. 129×129 cm, 33 courses. Upper cooking and lower heating bells; six parallel descents. Reconstruction under review.",
      lt: "I. S. Podgorodnikovas, 1992. 129×129 cm, 33 eilės. Viršutinė virimo ir apatinė šildymo kameros; šeši lygiagretūs kanalai. Rekonstrukcija tikrinama."
    },
    parameters: {
      foundationWidth: 162.5,
      foundationLength: 162.5,
      foundationThickness: 25,
      roomHeight: 300
    },
    rowCount: 33,
    lockedRows: [],
    rows,
    accent: "#A6472A"
  };
}
