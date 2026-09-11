import { brickPhysicalSolids, polyhedronVolumeMm3, solidPolyhedron } from "./geometry";
import type { ReadyProject } from "./types";

export const HOUSE_DESIGN = {
  id: "russian-house-6x9",
  revision: "R1",
  constructionApproved: false,
  verifiedOutputKw: null,
  widthMm: 6000,
  depthMm: 9000,
  ceilingMm: 2500,
  wallMm: 250,
  indoorC: 20,
  outdoorC: -30,
  bodyTopMm: 2025,
  chimneyTopMm: 6225,
  shaftWidthMm: 260,
  shaftDepthMm: 380,
  // Internal duct -> combustible boundary, not outside brick -> timber.
  penetrationGapMm: 500,
  // Selected layout, not surveyed roof/ground data.
  roofEavesMm: 2800,
  roofPitchDeg: 35,
  foundation: {
    widthMm: 2000,
    depthMm: 2300,
    capMm: 350,
    soleMm: 2200,
    pedestalWidthMm: 1900,
    pedestalDepthMm: 2200,
    footingMm: 350,
    assumedBearingKpa: 150,
    assumedFrostMm: 2000,
    assumedWaterDepthMm: 3000
  }
} as const;

export function heatDemand(envelope: {
  wallU: number;
  windowU: number;
  doorU: number;
  roofU: number;
  floorU: number;
  ach: number;
}) {
  const area = 54,
    volume = area * 2.5,
    deltaT = 50;
  const transmissionWK =
    65 * envelope.wallU + 8 * envelope.windowU + 2 * envelope.doorU + area * (envelope.roofU + envelope.floorU);
  const ventilationWK = 0.33 * envelope.ach * volume;
  const lossKw = ((transmissionWK + ventilationWK) * deltaT) / 1000;
  return { transmissionWK, ventilationWK, lossKw, designKw: lossKw * 1.1 };
}
export const HOUSE_HEAT = {
  // Proposed upgraded envelope; NOT the reported sawdust/coal ceiling.
  proposed: heatDemand({ wallU: 0.8, windowU: 1.2, doorU: 1.8, roofU: 0.2, floorU: 0.35, ach: 0.5 }),
  uncertain: heatDemand({ wallU: 0.8, windowU: 2.4, doorU: 2.5, roofU: 0.8, floorU: 0.65, ach: 0.8 }),
  weak: heatDemand({ wallU: 1.2, windowU: 2.8, doorU: 3, roofU: 1.2, floorU: 0.9, ach: 1.2 })
};

/** Gross buoyancy only. Subtracting an arbitrary loss coefficient would create
 * a fake positive draft margin; the gas temperatures and losses are not known. */
export function stackBuoyancyPa(gasC: number, outsideC = -30, heightM = (6225 - 415) / 1000) {
  const density = (c: number) => 353 / (273.15 + c);
  return 9.81 * heightM * (density(outsideC) - density(gasC));
}
export function rhsCheck(heightMm: number, widthMm: number, wallMm: number, spanMm: number, loadKn: number) {
  const inertia = (widthMm * heightMm ** 3 - (widthMm - 2 * wallMm) * (heightMm - 2 * wallMm) ** 3) / 12;
  const modulus = inertia / (heightMm / 2);
  const force = loadKn * 1000;
  return {
    inertia,
    modulus,
    stressMpa: (force * spanMm) / 8 / modulus,
    deflectionMm: (5 * force * spanMm ** 3) / (384 * 200000 * inertia)
  };
}
export function houseMassAndFoundation(project: ReadyProject) {
  let masonryM3 = 0,
    steelM3 = 0,
    mx = 0,
    my = 0,
    modelKg = 0;
  // Castings are enclosed editor proxies, not solid cast-iron blocks. Nominal
  // item masses are explicit allowances, awaiting the selected catalogue.
  const nominal: Record<string, number> = { plate: 20, grate: 7, damper: 4, cleanout: 8 };
  for (const b of Object.values(project.rows).flat()) {
    const solids = brickPhysicalSolids(b);
    const volume = solids.reduce((s, p) => s + polyhedronVolumeMm3(solidPolyhedron(p)) / 1e9, 0);
    const steel = b.custom?.material === "steel";
    if (b.kind === "custom") {
      if (steel) steelM3 += volume;
      else masonryM3 += volume;
    }
    const kg = b.kind === "custom" ? volume * (steel ? 7850 : 1800 * 1.15) : (nominal[b.kind] ?? 0);
    const centers = solids.map((p) => ({ x: ((p.box.x1 + p.box.x2) * 125) / 2, y: ((p.box.y1 + p.box.y2) * 125) / 2 }));
    const center = centers.reduce((a, p) => ({ x: a.x + p.x / centers.length, y: a.y + p.y / centers.length }), {
      x: 0,
      y: 0
    });
    // Item centroid is a bounding-centre approximation; stress is not certified.
    modelKg += kg;
    mx += kg * center.x;
    my += kg * center.y;
  }
  const f = HOUSE_DESIGN.foundation;
  const plateM3 = (f.widthMm * f.depthMm * (f.capMm + f.footingMm)) / 1e9;
  const pedestalM3 = (f.pedestalWidthMm * f.pedestalDepthMm * (f.soleMm - f.capMm - f.footingMm)) / 1e9;
  const foundationM3 = plateM3 + pedestalM3,
    foundationKg = foundationM3 * 2400;
  const totalKg = modelKg + foundationKg;
  const exM = (mx / totalKg + (foundationKg / totalKg) * 1000 - 1000) / 1000;
  const eyM = (my / totalKg + (foundationKg / totalKg) * 1150 - 1150) / 1000;
  const averageKpa = (totalKg * 9.81) / (2 * 2.3) / 1000;
  const eccentricFactor = (6 * Math.abs(exM)) / 2 + (6 * Math.abs(eyM)) / 2.3;
  return {
    masonryM3,
    steelM3,
    modelKg,
    foundationM3,
    foundationKg,
    totalKg,
    exM,
    eyM,
    averageKpa,
    minKpa: averageKpa * (1 - eccentricFactor),
    maxKpa: averageKpa * (1 + eccentricFactor)
  };
}

export const HOUSE_COURSES = [
  { row: 1, label: "Основание и коренная труба" },
  { row: 3, label: "Зольник и холодные подпечья" },
  { row: 5, label: "Кирпичная перемычка зольника" },
  { row: 6, label: "Колосник, опоры нижнего свода" },
  { row: 9, label: "Топка плиты и отдельный выход" },
  { row: 10, label: "Плита и перекрытие газохода" },
  { row: 11, label: "Под горнила" },
  { row: 16, label: "Устье, пяты и клинчатый свод" },
  { row: 22, label: "Перетрубье и прямой ход" },
  { row: 25, label: "П-образный верхний дымооборот" },
  { row: 29, label: "Трёхслойная перекрыша · верх 2,025 м" },
  { row: 36, label: "Труба на отметке потолка 2,50 м" },
  { row: 89, label: "Полная труба · верх 6,225 м" }
] as const;
