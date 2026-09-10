import type { PlacedBrick, ReadyProject } from "./types";

type Rect = { x: number; y: number; w: number; h: number };
type Point = { x: number; z: number };
const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
/** Shkolnik 1991 §63, figs 123–125. Millimetres; see docs/classic-russian-stove.md for interpolation. */
export function makeClassicRussianStove(): ReadyProject {
  const rows: Record<number, PlacedBrick[]> = {};
  let sequence = 0;
  const emit = (row: number, r: Rect, name: string, extra: Partial<PlacedBrick> = {}) => {
    const b: PlacedBrick = {
      id: `classic-${sequence++}`,
      row,
      x: (625 + r.x) / 125,
      y: (125 + r.y) / 125,
      kind: "custom",
      orientation: "h",
      custom: { name, w: r.w / 125, h: r.h / 125, cutFrom: "standard" },
      ...extra
    };
    rows[row] ??= [];
    rows[row].push(b);
    return b;
  };
  const subtract = (a: Rect, b: Rect): Rect[] => {
    const x = Math.max(a.x, b.x),
      y = Math.max(a.y, b.y);
    const right = Math.min(a.x + a.w, b.x + b.w),
      back = Math.min(a.y + a.h, b.y + b.h);
    if (right <= x || back <= y) return [a];
    if (b.h === 5)
      return [
        rect(a.x, a.y, x - a.x, a.h),
        rect(right, a.y, a.x + a.w - right, a.h),
        rect(x, a.y, right - x, y - a.y),
        rect(x, back, right - x, a.y + a.h - back)
      ].filter((r) => r.w > 1e-6 && r.h > 1e-6);
    return [
      rect(a.x, a.y, a.w, y - a.y),
      rect(a.x, back, a.w, a.y + a.h - back),
      rect(a.x, y, x - a.x, back - y),
      rect(right, y, a.x + a.w - right, back - y)
    ].filter((r) => r.w > 1e-6 && r.h > 1e-6);
  };
  const masonry = (row: number, areas: Rect[], holes: Rect[] = [], name = "Кладка · интерполированная перевязка") => {
    let occupied: Rect[] = [];
    for (const area of areas) {
      let pieces = [area];
      for (const prior of occupied) pieces = pieces.flatMap((p) => subtract(p, prior));
      occupied.push(...pieces);
    }
    const slots = [
      ...(row >= 25 && row <= 27 ? [rect(-120, 270, 205, 200)] : []),
      ...(row >= 10 && row <= 12 ? [rect(-5, 270, 5, 200)] : []),
      ...(row >= 28 && row <= 30 ? [rect(-5, 270, 5, 200)] : []),
      ...(row >= 31 && row <= 33 ? [rect(880, 515, 200, 5)] : []),
      ...(row === 28 ? [rect(-120, 245, 115, 225)] : []),
      ...(row === 31 ? [rect(-120, 445, 120, 230)] : [])
    ];
    for (const hole of [...holes, ...slots]) occupied = occupied.flatMap((p) => subtract(p, hole));
    for (const a of occupied) {
      const dx = row % 2 ? 250 : 125,
        dy = row % 2 ? 125 : 250;
      for (let y = a.y; y < a.y + a.h - 1e-6; y += dy)
        for (let x = a.x; x < a.x + a.w - 1e-6; x += dx)
          emit(row, rect(x, y, Math.min(dx, a.x + a.w - x), Math.min(dy, a.y + a.h - y)), name);
    }
  };
  const profile = (row: number, y: number, depth: number, points: Point[], name: string, rotated = false) => {
    if (points.length < 3) return;
    const min = Math.min(...points.map((p) => p.x)),
      max = Math.max(...points.map((p) => p.x));
    if (max - min < 1e-5 || Math.max(...points.map((p) => p.z)) - Math.min(...points.map((p) => p.z)) < 1e-5) return;
    const b = emit(row, rotated ? rect(y, min, depth, max - min) : rect(min, y, max - min, depth), name);
    b.orientation = rotated ? "v" : "h";
    b.custom = {
      name,
      w: (max - min) / 125,
      h: depth / 125,
      cutFrom: "standard",
      profileXZ: points.map((p) => ({ x: p.x - min, z: p.z - (row - 1) * 70 }))
    };
  };
  const clip = (p: Point[], z: number, above: boolean): Point[] => {
    const out: Point[] = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        ia = above ? a.z >= z : a.z <= z,
        ib = above ? b.z >= z : b.z <= z;
      if (ia) out.push(a);
      if (ia !== ib) {
        const t = (z - a.z) / (b.z - a.z);
        out.push({ x: a.x + t * (b.x - a.x), z });
      }
    }
    return out.filter((a, i) => !out.some((b, j) => j < i && Math.hypot(a.x - b.x, a.z - b.z) < 1e-6));
  };
  // Radial voussoirs, founded skewbacks and exact extrados infill; no intersecting boxes above a vault.
  const vault = (
    row: number,
    left: number,
    right: number,
    wallLeft: number,
    wallRight: number,
    spring: number,
    rise: number,
    top: number,
    y: number,
    depth: number,
    name: string,
    rotated = false
  ) => {
    const half = (right - left) / 2,
      cx = (left + right) / 2,
      radius = (half * half + rise * rise) / (2 * rise),
      cz = spring + rise - radius;
    const angle = Math.asin(half / radius),
      // A wedge fits a 65 × 120 × 250 blank in its radial frame.
      n = Math.ceil((2 * angle * (radius + 120)) / 60) | 1,
      thick = 120;
    const inner: Point[] = [],
      outer: Point[] = [];
    for (let i = 0; i <= n; i++) {
      const a = -angle + (i * 2 * angle) / n;
      inner.push({ x: cx + radius * Math.sin(a), z: cz + radius * Math.cos(a) });
      outer.push({ x: cx + (radius + thick) * Math.sin(a), z: cz + (radius + thick) * Math.cos(a) });
    }
    const fill: Point[][] = [
      [{ x: wallLeft, z: spring }, { x: left, z: spring }, outer[0], { x: wallLeft, z: outer[0].z }],
      [{ x: right, z: spring }, { x: wallRight, z: spring }, { x: wallRight, z: outer[n].z }, outer[n]],
      [{ x: wallLeft, z: outer[0].z }, outer[0], { x: outer[0].x, z: top }, { x: wallLeft, z: top }],
      [outer[n], { x: wallRight, z: outer[n].z }, { x: wallRight, z: top }, { x: outer[n].x, z: top }],
      ...outer.slice(0, -1).map((a, i) => [a, outer[i + 1], { x: outer[i + 1].x, z: top }, { x: a.x, z: top }])
    ];
    // Clip by parallel planes 2.5 mm inside each radial joint. Unlike angle
    // trimming this gives a true constant 5 mm mortar bed and parallel bearing faces.
    const halfPlane = (poly: Point[], nx: number, nz: number, limit: number) => {
      const result: Point[] = [];
      for (let j = 0; j < poly.length; j++) {
        const a = poly[j],
          b = poly[(j + 1) % poly.length];
        const da = nx * a.x + nz * a.z - limit,
          db = nx * b.x + nz * b.z - limit;
        if (da <= 1e-8) result.push(a);
        if (da < 0 !== db < 0) {
          const t = da / (da - db);
          result.push({ x: a.x + t * (b.x - a.x), z: a.z + t * (b.z - a.z) });
        }
      }
      return result;
    };
    // Axial joints shift by half a module between adjacent radial courses.
    // End closures are half bricks, not slivers; no through transverse joint.
    const lengths = (shift: boolean, maximum = 250) => {
      const pitch = depth / Math.ceil(depth / maximum);
      const cuts = [0];
      for (let v = shift ? pitch / 2 : pitch; v < depth - 1e-6; v += pitch) cuts.push(v);
      cuts.push(depth);
      return cuts.slice(0, -1).map((v, j) => ({
        start: v + (j ? 2.5 : 0),
        length: cuts[j + 1] - v - (j ? 2.5 : 0) - (j < cuts.length - 2 ? 2.5 : 0)
      }));
    };
    for (let i = 0; i < n; i++) {
      let poly = [inner[i], inner[i + 1], outer[i + 1], outer[i]];
      for (const [edge, sign] of [
        [i, -1],
        [i + 1, 1]
      ]) {
        const a = -angle + (edge * 2 * angle) / n;
        const nx = sign * Math.cos(a),
          nz = -sign * Math.sin(a);
        poly = halfPlane(poly, nx, nz, nx * cx + nz * cz - 2.5);
      }
      const middle = -angle + ((i + 0.5) * 2 * angle) / n;
      poly = halfPlane(
        poly,
        Math.sin(middle),
        Math.cos(middle),
        Math.sin(middle) * cx + Math.cos(middle) * cz + (radius + thick) * Math.cos(angle / n) - 2.5
      );
      const actualRow = Math.floor((Math.min(...poly.map((p) => p.z)) + 1e-6) / 70) + 1;
      for (const [bay, segment] of lengths(i % 2 === 1 && depth > 250).entries()) {
        profile(
          actualRow,
          y + segment.start,
          segment.length,
          poly,
          `${name} · клин ${i + 1} · пояс ${bay + 1}`,
          rotated
        );
      }
    }
    for (let course = row; (course - 1) * 70 < top; course++) {
      for (const segment of lengths(course % 2 === 1 && depth > 250, 120)) {
        for (const poly of fill) {
          const low = Math.min(...poly.map((p) => p.x)),
            high = Math.max(...poly.map((p) => p.x));
          const count = Math.max(1, Math.ceil((high - low) / 240));
          for (let k = 0; k < count; k++) {
            const lo = low + (k * (high - low)) / count,
              hi = low + ((k + 1) * (high - low)) / count;
            const piece = halfPlane(halfPlane(poly, -1, 0, -lo), 1, 0, hi);
            profile(
              course,
              y + segment.start,
              segment.length,
              clip(clip(piece, (course - 1) * 70, true), Math.min(top, (course - 1) * 70 + 65), false),
              `${name} · пята / пазуха`,
              rotated
            );
          }
        }
      }
    }
  };
  const body = rect(0, 0, 1200, 2000),
    chimney = rect(-500, 150, 500, 620),
    shaft = rect(-380, 270, 260, 380);
  masonry(1, [body, chimney]);
  // Large cold underoven opens on the right; barrel runs across the length, as fig.123г /124е.
  for (let row = 2; row <= 5; row++)
    masonry(row, [rect(0, 650, 120, 1350), rect(120, 650, 1080, 150), rect(120, 1750, 1080, 250)]);
  vault(6, 800, 1750, 650, 2000, 350, 170, 700, 120, 1080, "Большое подпечье", true);
  for (let row = 6; row <= 10; row++) masonry(row, [rect(0, 650, 120, 1350)]);
  // Small front underoven beneath the hob flue; independently founded barrel.
  for (let row = 2; row <= 3; row++) masonry(row, [rect(0, 0, 120, 650), rect(650, 0, 550, 650)]);
  vault(4, 120, 650, 0, 770, 210, 70, 420, 0, 650, "Малое подпечье");
  const ash = rect(825, 120, 190, 380),
    fire = rect(780, 120, 250, 400),
    duct = rect(-120, 270, 900, 200);
  for (let row = 4; row <= 5; row++)
    masonry(
      row,
      [rect(770, 0, 430, 650)],
      [ash, rect(825, 0, 190, 120), ...(row === 5 ? [rect(810, 125, 220, 270), rect(795, 395, 250, 105)] : [])]
    );
  emit(5, rect(795, 395, 250, 105), "Задняя опора колосника");
  for (const x of [810, 1015])
    profile(
      5,
      125,
      270,
      [
        { x, z: 280 },
        { x: x + 15, z: 280 },
        { x: x + 15, z: 325 },
        { x, z: 325 }
      ],
      "Полка колосника"
    );
  // R6–9: stove fire and the passage over the small barrel to the independent chimney.
  for (let row = 6; row <= 9; row++)
    masonry(
      row,
      [rect(770, 0, 430, 650), ...(row >= 7 ? [rect(0, 0, 770, 650)] : [])],
      [fire, rect(780, 0, 250, 120), ...(row >= 7 ? [duct] : [])]
    );
  // Peréval: brick threshold between firebox and outlet, stopping short of the hob soffit.

  // R10 hob recess; bridge the fire door on source steel, not on its frame.
  const steel = (row: number, r: Rect, z: number, height: number, name: string) => {
    const b = emit(row, r, name);
    b.custom = {
      name,
      material: "steel",
      w: r.w / 125,
      h: r.h / 125,
      profileXZ: [
        { x: 0, z },
        { x: r.w, z },
        { x: r.w, z: z + height },
        { x: 0, z: z + height }
      ]
    };
    return b;
  };
  steel(10, rect(700, 0, 400, 120), 0, 5, "Стальная перемычка топочной дверцы · рис.124");
  for (const [x, w] of [
    [700, 250],
    [950, 150]
  ])
    profile(
      10,
      0,
      120,
      [
        { x, z: 635 },
        { x: x + w, z: 635 },
        { x: x + w, z: 695 },
        { x, z: 695 }
      ],
      "Кладка над перемычкой топочной дверцы"
    );
  // Small flue roof has real bearing on the two side walls (200 mm clear, 25 mm ends).
  for (let x = 0; x < 780; x += 125) emit(10, rect(x, 245, Math.min(125, 780 - x), 250), "Перекрытие газохода плиты");
  masonry(10, [rect(0, 0, 1200, 650)], [rect(0, 245, 780, 250), rect(300, 120, 710, 400), rect(700, 0, 400, 120)]);
  // Raised hearth: no descents into the cold underoven; model hearth top 765 mm, hob top 700 mm.
  masonry(11, [rect(0, 520, 1200, 1480)]);
  // Conventional gorniło, mouth and cheeks. Full chamber floor; no Teplushka lower bell.
  for (let row = 12; row <= 15; row++)
    masonry(
      row,
      [rect(0, 650, 120, 1350), rect(1080, 650, 120, 1350), rect(120, 1880, 960, 120), rect(0, 520, 1200, 130)],
      [rect(390, 520, 420, 130)]
    );
  // Mouth arch spans 420 mm; chamber barrel spans 960 mm. Both use genuine radial profiles.
  vault(16, 390, 810, 0, 1200, 1050, 70, 1540, 520, 130, "Арка устья");
  vault(16, 120, 1080, 0, 1200, 1050, 180, 1540, 650, 1230, "Свод горнила");
  for (let row = 16; row <= 22; row++) masonry(row, [rect(0, 1880, 1200, 120)]);
  // Source metal shelf supports the front hood; the rear edge bears on the cheeks.
  // Rectangular steel proxy for fig.125 bent round stock, explicitly documented, independently founded.
  steel(11, rect(1080, 120, 30, 30), 0, 550, "Стойка шестка · эквивалент стержня рис.125");
  steel(18, rect(0, 120, 1110, 50), 60, 10, "Полоса перетрубья · рис.125");
  steel(18, rect(0, 170, 50, 350), 60, 10, "Левая полоса перетрубья");
  steel(18, rect(1060, 170, 50, 350), 60, 10, "Правая полоса перетрубья");
  // Hood walls connect directly to the mouth; open front remains below the source steel shelf.
  for (let row = 19; row <= 27; row++) {
    const t = row === 19 ? 50 : 85;
    masonry(row, [rect(0, 120, t, 400), rect(1110 - t, 120, t, 400), rect(t, 120, 1110 - 2 * t, t)]);
  }
  steel(26, rect(0, 470, 320, 50), 65, 5, "Опора пола возвратного канала · интерполяция");
  masonry(27, [rect(85, 470, 235, 50)]);
  // Solid back chamber mass below the upper U-shaped smoke circuit.
  for (let row = 23; row <= 27; row++) masonry(row, [rect(0, 520, 1200, 1480)]);
  // Upper horizontal loop: entrance on right, rear turn, return on left to chimney (fig.124д).
  const loop = [
    rect(120, 650, 200, 1110),
    rect(120, 1760, 960, 200),
    rect(880, 520, 200, 1240),
    rect(-120, 470, 440, 180)
  ];
  for (let row = 28; row <= 30; row++)
    masonry(row, [body], [...loop, rect(85, 205, 940, 215), rect(880, 420, 200, 100)]);
  // Roof over 200 mm runs: full bricks span both side bearings; rear leg is likewise capped.
  for (let y = 650; y < 1735; y += 125) {
    emit(31, rect(95, y, 250, Math.min(125, 1735 - y)), "Левый канал · перекрытие с опиранием");
    emit(31, rect(855, y, 250, Math.min(125, 1735 - y)), "Правый канал · перекрытие с опиранием");
  }
  for (let x = 95; x < 1105; x += 125)
    emit(31, rect(x, 1735, Math.min(125, 1105 - x), 250), "Задний канал · перекрытие с опиранием");
  // Hood roof carried by source-style steel strips across its open span (interpolated extension).
  for (const y of [205, 330, 455, 580])
    steel(31, rect(0, y, 1105, 50), 0, 5, "Перекрыша перетрубья · интерполированная полоса");
  masonry(
    31,
    [body],
    [rect(95, 650, 250, 1085), rect(855, 650, 250, 1085), rect(95, 1735, 1010, 250), rect(0, 205, 1105, 425)]
  );
  for (let y = 205; y < 630; y += 125)
    for (let x = 0; x < 1105; x += 250) {
      const w = Math.min(250, 1105 - x),
        d = Math.min(125, 630 - y);
      // The gate blade travels in its own slot, including through this cap.
      const pieces = [rect(x, y, w, d)].flatMap((r) => subtract(r, rect(880, 515, 200, 5)));
      for (const r of pieces)
        profile(
          31,
          r.y,
          r.h,
          [
            { x: r.x, z: 2105 },
            { x: r.x + r.w, z: 2105 },
            { x: r.x + r.w, z: 2165 },
            { x: r.x, z: 2165 }
          ],
          "Перекрыша на полосах"
        );
    }
  for (let row = 32; row <= 33; row++) masonry(row, [body]);
  // Independent rooted chimney: three solid starting courses, open shaft thereafter.
  for (let row = 2; row <= 35; row++)
    masonry(
      row,
      [chimney],
      row <= 3
        ? []
        : [
            shaft,
            ...(row >= 7 && row <= 9 ? [rect(-120, 270, 120, 200)] : []),
            ...(row >= 25 && row <= 27 ? [rect(-120, 270, 120, 200), rect(0, 270, 85, 200)] : []),
            ...(row >= 28 && row <= 30 ? [rect(-120, 470, 120, 180)] : [])
          ]
    );
  emit(28, rect(-120, 245, 115, 225), "Перемычка прямого хода · опирание 25 мм");
  emit(31, rect(-120, 445, 120, 230), "Перемычка возврата · опирание 25 мм");
  const hardware = (row: number, r: Rect, name: string, kind: PlacedBrick["kind"], heightMm: number) =>
    emit(row, r, name, { id: `classic-${name}`, kind, custom: { name, w: r.w / 125, h: r.h / 125, heightMm } });
  hardware(4, rect(825, 0, 190, 120), "ash-door", "cleanout", 135);
  hardware(6, rect(780, 0, 250, 120), "fire-door", "cleanout", 275);
  const grate = hardware(5, rect(810, 125, 220, 270), "grate-270x220", "grate", 20);
  grate.custom!.thicknessMm = 20;
  const hob = hardware(10, rect(300, 120, 710, 400), "hob-710x400", "plate", 5);
  hob.custom!.thicknessMm = 5;
  // Three independently operable physical vertical gates; no stove-specific editor controls.
  for (const [row, y, h, id, open] of [
    [7, 270, 200, "hob-gate", 1],
    [25, 270, 200, "direct-gate", 0],
    [28, 880, 200, "upper-loop-gate", 1]
  ] as const) {
    const upper = id === "upper-loop-gate";
    const b = hardware(row, upper ? rect(y, 515, h, 5) : rect(-5, y, 5, h), id, "damper", 210);
    b.custom!.damperPlane = "vertical";
    b.custom!.damperFrameMm = 0;
    b.custom!.thicknessMm = 5;
    b.custom!.seatZMm = 0;
    b.custom!.damperSlide = "up";
    b.damperOpen = open;
  }
  return {
    id: "classic-russian-stove-hob",
    title: {
      ru: "Русская печь с плитой · классическая",
      en: "Classical Russian oven with hob",
      lt: "Klasikinė rusiška krosnis su virykle"
    },
    subtitle: {
      ru: "Школьник, 1991 · ПР-3500В. Горнило, два сводчатых подпечья, плита в шестке и верхний дымооборот. Отдельная редактируемая реконструкция; размеры и интерполяция — в источнике проекта.",
      en: "Shkolnik 1991 · PR-3500V. Hearth, vaulted cold underovens, hob and upper smoke circuit. Independent editable reconstruction; see source notes for interpolation.",
      lt: "Školnikas, 1991 · PR-3500V. Židinys, skliautuotos ertmės, viryklė ir viršutinis dūmų kanalas. Atskira redaguojama rekonstrukcija."
    },
    parameters: { foundationWidth: 200, foundationLength: 225, foundationThickness: 25, roomHeight: 300 },
    rowCount: 35,
    lockedRows: [],
    rows,
    accent: "#8C573B"
  };
}
export const CLASSIC_RUSSIAN_STOVE = makeClassicRussianStove();
