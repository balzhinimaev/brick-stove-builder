import { stockGrid, uniteCutBricks, verticalJoints } from "./masonryLayout";
import type { PlacedBrick, ReadyProject } from "./types";

type Rect = { x: number; y: number; w: number; h: number };
type Point = { x: number; z: number };
const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
/** RP54 R1: independent low-layout design study. NOT an unchanged Shkolnik order or a construction release. */
export function makeHouseRussianStove(revision: "R1" | "R2" = "R1"): ReadyProject {
  const rows: Record<number, PlacedBrick[]> = {};
  let sequence = 0;
  const emit = (row: number, r: Rect, name: string, extra: Partial<PlacedBrick> = {}) => {
    const b: PlacedBrick = {
      id: `rp54-${sequence++}`,
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
  const masonry = (row: number, areas: Rect[], holes: Rect[] = [], name = "Кладка · шов 5 мм") => {
    let occupied: Rect[] = [];
    for (const area of areas) {
      let pieces = [area];
      for (const prior of occupied) pieces = pieces.flatMap((p) => subtract(p, prior));
      occupied.push(...pieces);
    }
    const slots = [
      ...(row >= 19 && row <= 21 ? [rect(-120, 270, 205, 200)] : []),
      ...(row >= 10 && row <= 12 ? [rect(-5, 270, 5, 200)] : []),
      ...(row >= 23 && row <= 24 ? [rect(155, 1880, 180, 120), rect(855, 1880, 180, 120)] : []),
      ...(row >= 22 && row <= 25 ? [rect(-5, 270, 5, 200)] : []),
      ...(row >= 23 && row <= 30 ? [rect(-5, 470, 5, 180)] : [])
    ];
    // Full-course seats are known before R2 tiling, so their edge remnants can
    // participate in closure planning. The exact final 3D seat cut still runs.
    if (revision === "R2") {
      if (row === 22) slots.push(rect(-120, 245, 115, 250));
      if (row === 27) slots.push(rect(-120, 435, 110, 250));
    }
    for (const hole of [...holes, ...slots]) occupied = occupied.flatMap((p) => subtract(p, hole));
    const lowerJoints = revision === "R2" ? verticalJoints(rows[row - 1] ?? []) : [];
    for (const a of occupied) {
      const dx = row % 2 ? 250 : 120,
        dy = row % 2 ? 120 : 250;
      if (revision === "R2") {
        const grid = stockGrid(
          a.w,
          a.h,
          row,
          625 + a.x,
          125 + a.y,
          lowerJoints,
          occupied.map((p) => ({ ...p, x: p.x + 625, y: p.y + 125 }))
        );
        for (const sy of grid.ys)
          for (const sx of grid.xs) emit(row, rect(a.x + sx.start, a.y + sy.start, sx.length, sy.length), name);
        continue;
      }
      const nx = Math.max(1, Math.ceil((a.w + 5) / (dx + 5)));
      const ny = Math.max(1, Math.ceil((a.h + 5) / (dy + 5)));
      const w = (a.w - 5 * (nx - 1)) / nx,
        h = (a.h - 5 * (ny - 1)) / ny;
      for (let iy = 0; iy < ny; iy++)
        for (let ix = 0; ix < nx; ix++) emit(row, rect(a.x + ix * (w + 5), a.y + iy * (h + 5), w, h), name);
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
    // Fan joints: angular trimming through the circle centre gives a thinner
    // intrados and at most 5 mm at the extrados. End skewback beds remain 2.5 mm.
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
        const end = edge === 0 || edge === n;
        const a = -angle + (edge * 2 * angle) / n - (end ? 0 : sign * Math.asin(2.5 / (radius + thick)));
        const nx = sign * Math.cos(a),
          nz = -sign * Math.sin(a);
        poly = halfPlane(poly, nx, nz, nx * cx + nz * cz - (end ? 2.5 : 0));
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
  // §63: the 190 × 380 ash cavity starts in R3, below the separate hob firebox.
  const ash = rect(810, 120, 190, 380),
    ashDoor = rect(810, 0, 190, 120),
    ashHeader = rect(780, 0, 250, 120),
    gratePocket = rect(790, 120, 230, 280),
    fire = rect(780, 120, 250, 400),
    duct = rect(-120, 270, 900, 200);
  // Small front underoven beneath the hob flue; independently founded barrel.
  for (let row = 2; row <= 3; row++)
    masonry(row, [rect(0, 0, 120, 650), rect(650, 0, 550, 650)], row === 3 ? [ash, ashDoor] : []);
  vault(4, 120, 650, 0, 770, 210, 70, 420, 0, 650, "Малое подпечье");
  for (let row = 4; row <= 5; row++) masonry(row, [rect(770, 0, 430, 650)], [ash, row === 4 ? ashDoor : ashHeader]);
  // A full 250 mm brick bridges the 190 mm ash opening in R5: 30 mm on each jamb.
  // R6 bonds over it. Neither the door frame nor the grate carries this header.
  emit(5, ashHeader, "Перемычка зольника · полный кирпич · R1, 5-й ряд");
  masonry(6, [rect(770, 0, 430, 650)], [gratePocket]);
  // R6 grate rebate: 5 mm expansion clearance around 220 × 270 iron;
  // lower side ledges support its frame and leave the ash-air passage open.
  for (const x of [790, 1000])
    for (const y of [120, 260])
      profile(
        6,
        y,
        140,
        [
          { x, z: 350 },
          { x: x + 20, z: 350 },
          { x: x + 20, z: 395 },
          { x, z: 395 }
        ],
        "Полка колосника"
      );
  // R7–9: the source fire door starts above the R6 grate/floor, not at its level.
  // The 280 mm combustion height runs from grate top 415 to hob underside 695.
  for (let row = 7; row <= 9; row++)
    masonry(row, [rect(770, 0, 430, 650), rect(0, 0, 770, 650)], [fire, rect(780, 0, 250, 120), duct]);
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
  steel(10, rect(700, 0, 400, 120), 0, 5, "Стальная перемычка топочной дверцы · узел R1");
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
  for (let x = 0; x < 780; x += 125) emit(10, rect(x, 245, Math.min(120, 780 - x), 250), "Перекрытие газохода плиты");
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
  // The old thin flat-strip proxy is NOT reused as a 1.1 m hot lintel.
  // Explicit RHS frame: actual hollow walls and calculated section properties.
  const rhs = (
    row: number,
    x: number,
    y: number,
    length: number,
    width: number,
    height: number,
    z: number,
    name: string,
    alongY = false
  ) => {
    const t = 5;
    const parts = [
      rect(0, 0, length, width),
      rect(0, 0, length, width),
      rect(0, 0, length, t),
      rect(0, width - t, length, t)
    ];
    const zs = [z, z + height - t, z + t, z + t],
      hs = [t, t, height - 2 * t, height - 2 * t];
    for (let i = 0; i < 4; i++) {
      const r = parts[i];
      steel(
        row,
        alongY ? rect(x + r.y, y + r.x, r.h, r.w) : rect(x + r.x, y + r.y, r.w, r.h),
        zs[i],
        hs[i],
        `${name} · стенка ${i + 1}`
      );
    }
  };
  steel(11, rect(0, 120, 100, 100), 0, 10, "Опорная плита рамы 100×100×10 · левая");
  steel(11, rect(1010, 120, 100, 100), 0, 10, "Опорная плита рамы 100×100×10 · правая");
  steel(11, rect(0, 120, 40, 40), 10, 460, "Стойка перетрубья левая · сталь 40×40");
  steel(11, rect(1070, 120, 40, 40), 10, 460, "Стойка перетрубья правая · сталь 40×40");
  rhs(17, 0, 120, 1110, 50, 90, 50, "Рама перетрубья · RHS 90×50×5");
  rhs(17, 0, 170, 350, 50, 90, 50, "Рама перетрубья · боковина", true);
  rhs(17, 1060, 170, 350, 50, 90, 50, "Рама перетрубья · боковина", true);
  for (let row = 19; row <= 22; row++) {
    const t = row === 19 ? 50 : 85;
    masonry(row, [rect(0, 120, t, 400), rect(1110 - t, 120, t, 400), rect(t, 120, 1110 - 2 * t, t)]);
  }
  // A NEW lowered U-shaped circuit, not deleted source courses. Its entire
  // internal section is 200 x 280 mm: z1540..1820. The three full cap courses
  // are above z1820, not used to squeeze this passage.
  const loop = [
    rect(120, 650, 200, 1030),
    rect(120, 1680, 960, 200),
    rect(880, 520, 200, 1160),
    rect(-120, 470, 440, 180)
  ];
  steel(21, rect(0, 470, 320, 50), 65, 5, "Опора входа возврата · расчётный узел R1");
  masonry(22, [rect(85, 470, 235, 50)]);
  for (let row = 23; row <= 26; row++) {
    masonry(row, [body], [...loop, rect(85, 205, 940, 215), rect(880, 420, 200, 100)]);
  }
  // Across each 200 mm duct, full 250 mm headers retain 25 mm end bearing.
  const lifted = (row: number, r: Rect, name: string, z = 0) => {
    const b = emit(row, r, name);
    b.custom!.profileXZ = [
      { x: 0, z },
      { x: r.w, z },
      { x: r.w, z: z + 65 },
      { x: 0, z: z + 65 }
    ];
    return b;
  };
  const sideDepth = (1005 - 5 * 8) / 9;
  for (let i = 0; i < 9; i++) {
    const y = 650 + i * (sideDepth + 5);
    lifted(27, rect(95, y, 250, sideDepth), "Левый канал · перекрыша");
    lifted(27, rect(855, y, 250, sideDepth), "Правый канал · перекрыша");
  }
  const backWidth = (1010 - 5 * 8) / 9;
  for (let i = 0; i < 9; i++)
    lifted(27, rect(95 + i * (backWidth + 5), 1655, backWidth, 250), "Задний канал · перекрыша");
  // The hood roof is a distinct structural detail. These members are modelled
  // as steel, never brick and never proof of hot-state strength.
  for (const y of [205, 330, 455, 580]) rhs(25, 5, y, 1095, 50, 100, 40, "Балка перекрыши · RHS 100×50×5");
  const baseCount = rows[27]?.length ?? 0;
  masonry(
    27,
    [body],
    [rect(95, 650, 250, 1005), rect(855, 650, 250, 1005), rect(95, 1655, 1010, 250), rect(0, 205, 1105, 425)]
  );
  for (const b of rows[27].slice(baseCount)) {
    b.custom!.profileXZ = [
      { x: 0, z: 0 },
      { x: b.custom!.w * 125, z: 0 },
      { x: b.custom!.w * 125, z: 65 },
      { x: 0, z: 65 }
    ];
  }
  for (let y = 205; y < 630; y += 125)
    for (let x = 0; x < 1105; x += 255)
      lifted(27, rect(x, y, Math.min(250, 1105 - x), Math.min(120, 630 - y)), "Перекрыша на стали");
  for (const row of [28, 29]) masonry(row, [body]);
  // Full rooted chimney up to 6.225 m above floor, not a token top fragment.
  for (let row = 2; row <= 89; row++)
    masonry(
      row,
      [chimney],
      row <= 3
        ? []
        : [
            shaft,
            ...(row >= 7 && row <= 9 ? [rect(-120, 270, 120, 200)] : []),
            ...(row >= 19 && row <= 21 ? [rect(-120, 270, 205, 200)] : []),
            ...(row >= 23 && row <= 26 ? [rect(-120, 470, 120, 180)] : []),
            ...(row >= 4 && row <= 5 ? [rect(-500, 350, 120, 130)] : [])
          ]
    );

  // Close the return inlet with a full R27 header at z1820.

  // Give the roof members actual pockets in the side masonry. Brick parts
  // keep their own material and stock size; steel remains a separate solid.
  for (const r of [22, 25, 26, 27])
    for (const b of [...(rows[r] ?? [])]) {
      if (b.custom?.material === "steel" || b.kind !== "custom") continue;
      const pp = b.custom!.profileXZ;
      if (pp && (pp.length !== 4 || !pp.every((p) => p.x === 0 || p.x === b.custom!.w * 125))) continue;
      let boxes = [
        {
          x: b.x * 125 - 625,
          y: b.y * 125 - 125,
          w: b.custom!.w * 125,
          h: b.custom!.h * 125,
          z: (r - 1) * 70 + (pp ? Math.min(...pp.map((p) => p.z)) : 0),
          top: (r - 1) * 70 + (pp ? Math.max(...pp.map((p) => p.z)) : 65)
        }
      ];
      for (const seat of [
        ...[205, 330, 455, 580].map((yy) => ({ x: 5, y: yy, w: 1095, h: 50, z: 1720, top: 1820 })),
        { x: -120, y: 245, w: 115, h: 250, z: 1470, top: 1535 },
        { x: -120, y: 435, w: 110, h: 250, z: 1820, top: 1885 },
        ...[132.5, 832.5].map((x) => ({ x, y: 1880, w: 225, h: 120, z: 1680, top: 1745 }))
      ]) {
        const out: typeof boxes = [];
        for (const q of boxes) {
          const a = Math.max(q.x, seat.x),
            c = Math.min(q.x + q.w, seat.x + seat.w),
            d = Math.max(q.y, seat.y),
            e = Math.min(q.y + q.h, seat.y + seat.h);
          const lo = Math.max(q.z, seat.z),
            hi = Math.min(q.top, seat.top);
          if (c <= a || e <= d || hi <= lo) {
            out.push(q);
            continue;
          }
          const ps = [
            { ...q, top: lo },
            { ...q, z: hi },
            { x: q.x, y: q.y, w: a - q.x, h: q.h, z: lo, top: hi },
            { x: c, y: q.y, w: q.x + q.w - c, h: q.h, z: lo, top: hi },
            { x: a, y: q.y, w: c - a, h: d - q.y, z: lo, top: hi },
            { x: a, y: e, w: c - a, h: q.y + q.h - e, z: lo, top: hi }
          ];
          out.push(...ps.filter((p) => p.w > 1e-6 && p.h > 1e-6 && p.top - p.z > 1e-6));
        }
        boxes = out;
      }
      rows[r] = rows[r].filter((v) => v.id !== b.id);
      for (const q of boxes)
        profile(
          r,
          q.y,
          q.h,
          [
            { x: q.x, z: q.z },
            { x: q.x + q.w, z: q.z },
            { x: q.x + q.w, z: q.top },
            { x: q.x, z: q.top }
          ],
          b.custom!.name
        );
    }
  emit(22, rect(-120, 245, 115, 250), "Перемычка прямого хода · R1");
  lifted(27, rect(-120, 435, 110, 250), "Перемычка возврата · R1");
  for (const x of [132.5, 832.5]) emit(25, rect(x, 1880, 225, 120), "Перемычка прочистки верхнего хода");
  const hardware = (row: number, r: Rect, name: string, kind: PlacedBrick["kind"], heightMm: number) =>
    emit(row, r, name, { id: `rp54-${name}`, kind, custom: { name, w: r.w / 125, h: r.h / 125, heightMm } });
  hardware(23, rect(155, 1880, 180, 120), "upper-cleanout-left", "cleanout", 135);
  hardware(23, rect(855, 1880, 180, 120), "upper-cleanout-right", "cleanout", 135);
  hardware(4, rect(-500, 350, 120, 130), "chimney-cleanout", "cleanout", 135);
  // Casting dimensions are fitted to the sourced course openings, not source catalogue sizes.
  hardware(3, ashDoor, "ash-door", "cleanout", 135);
  hardware(7, rect(780, 0, 250, 120), "fire-door", "cleanout", 205);
  const grate = hardware(6, rect(795, 125, 220, 270), "grate-270x220", "grate", 20);
  grate.custom!.thicknessMm = 20;
  const hob = hardware(10, rect(300, 120, 710, 400), "hob-710x400", "plate", 5);
  hob.custom!.thicknessMm = 5;
  // Three independently operable physical vertical gates; no stove-specific editor controls.
  for (const [row, y, h, id, open] of [
    [7, 270, 200, "hob-gate", 1],
    [19, 270, 200, "direct-gate", 0],
    [23, 470, 180, "upper-loop-gate", 1]
  ] as const) {
    const upper = id === "upper-loop-gate";
    const b = hardware(row, rect(-5, y, 5, h), id, "damper", upper ? 280 : 210);
    b.custom!.damperPlane = "vertical";
    b.custom!.damperFrameMm = 0;
    b.custom!.thicknessMm = 5;
    b.custom!.seatZMm = 0;
    b.custom!.damperSlide = "up";
    b.damperOpen = open;
  }
  if (revision === "R2")
    for (const row of Object.keys(rows)) {
      rows[Number(row)] = uniteCutBricks(rows[Number(row)]).map((b) =>
        /^rp54-\d+$/.test(b.id) ? { ...b, id: b.id.replace("rp54-", "rp54-r2-") } : b
      );
    }
  return {
    id: revision === "R2" ? "russian-house-6x9-r2" : "russian-house-6x9",
    title: {
      ru: `Русская печь · дом 6×9 · ${revision}`,
      en: `Russian stove · 6×9 house · ${revision}`,
      lt: `Rusiška krosnis · 6×9 namas · ${revision}`
    },
    subtitle: {
      ru: "Отдельная низкая 3D-компоновка: горнило, плита, своды, дымооборот 200×280 мм и полная труба. Расчётные допущения и нерешённые строительные проверки — в карточке проекта.",
      en: "Independent low-layout design study with full chimney. Conditional calculations; not a site-approved construction design.",
      lt: "Atskiras žemos krosnies projektinis modelis. Sąlyginiai skaičiavimai; ne statybos leidimas."
    },
    parameters: { foundationWidth: 200, foundationLength: 230, foundationThickness: 35, roomHeight: 250 },
    rowCount: 89,
    lockedRows: [],
    rows,
    accent: "#895737"
  };
}
export const HOUSE_RUSSIAN_STOVE = makeHouseRussianStove();

export const HOUSE_RUSSIAN_STOVE_R2 = makeHouseRussianStove("R2");
