import { brickPhysicalSolids, polyhedronVolumeMm3, solidPolyhedron } from "./geometry";
import { partBounds, rectangularParts, THIN_PART_MM, verticalJoints } from "./masonryLayout";
import type { PlacedBrick } from "./types";

export type MasonryIssue = {
  key: string;
  kind: "thin" | "cut-detail" | "stock" | "bond";
  row: number;
  ids: string[];
  dimensions: number[];
  value: number;
};
export const mmLabel = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");
export const isMasonryPiece = (b: PlacedBrick) =>
  ["standard", "cut", "trim", "firebrick", "rebate", "custom"].includes(b.kind) && b.custom?.material !== "steel";

export function masonryDimensions(b: PlacedBrick): number[] {
  const parts = brickPhysicalSolids(b);
  if (!parts.length) return [];
  return [
    (Math.max(...parts.map((s) => s.box.x2)) - Math.min(...parts.map((s) => s.box.x1))) * 125,
    (Math.max(...parts.map((s) => s.box.y2)) - Math.min(...parts.map((s) => s.box.y1))) * 125,
    Math.max(...parts.map((s) => s.z2)) - Math.min(...parts.map((s) => s.z1))
  ];
}

/** Human-readable, spreadsheet-safe per-brick schedule. No inferred purchasing,
 * offcut reuse, saw kerf or mortar quantities. Exact profiles travel in JSON. */
export function masonryCsv(bricks: PlacedBrick[]): string {
  const cell = (v: string | number) => {
    const text = String(v);
    return `"${(/^[=+@-]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
  };
  const records: (string | number)[][] = [
    ["Ряд", "Номер детали", "Узел", "Габарит X, мм", "Габарит Y, мм", "Габарит Z, мм", "Форма", "Количество"]
  ];
  for (const b of bricks.filter(isMasonryPiece)) {
    const dimensions = masonryDimensions(b);
    records.push([
      b.row,
      b.id,
      b.custom?.name ?? b.kind,
      ...dimensions.map(mmLabel),
      b.custom?.solidParts
        ? "Единый кирпич с вырезами"
        : rectangularParts(b)
          ? "Прямоугольная"
          : "Профильная: раскрой по чертежу",
      1
    ]);
  }
  return `\uFEFF${records.map((r) => r.map(cell).join(";")).join("\r\n")}\r\n`;
}
const stockFits = (dims: number[]) =>
  dims
    .slice()
    .sort((a, b) => a - b)
    .every((n, i) => n <= [65, 120, 250][i] + 1e-5);

/** Geometry-derived inventory, not a purchase estimate. A compound brick is one item. */
export function auditMasonry(bricks: PlacedBrick[]) {
  let full = 0,
    rectangular = 0,
    shaped = 0,
    volumeMm3 = 0;
  const issues: MasonryIssue[] = [];
  const masonry = bricks.filter(isMasonryPiece);
  for (const b of masonry) {
    const solids = brickPhysicalSolids(b);
    volumeMm3 += solids.reduce((v, s) => v + polyhedronVolumeMm3(solidPolyhedron(s)), 0);
    const parts = rectangularParts(b);
    const c = b.custom;
    if (!parts) {
      if (!c && (b.kind === "standard" || b.kind === "firebrick")) full++;
      else if (!c && (b.kind === "cut" || b.kind === "trim")) rectangular++;
      else shaped++;
      if (c?.profileXZ) {
        // Wedges are cut in their own radial frame, not their world AABB.
        const p = c.profileXZ;
        const fits = p.some((a, i) => {
          const next = p[(i + 1) % p.length],
            angle = Math.atan2(next.z - a.z, next.x - a.x);
          const x = p.map((v) => v.x * Math.cos(angle) + v.z * Math.sin(angle));
          const z = p.map((v) => -v.x * Math.sin(angle) + v.z * Math.cos(angle));
          return stockFits([Math.max(...x) - Math.min(...x), Math.max(...z) - Math.min(...z), c.h * 125]);
        });
        if (!fits)
          issues.push({
            key: `stock:${b.id}`,
            kind: "stock",
            row: b.row,
            ids: [b.id],
            dimensions: masonryDimensions(b),
            value: 0
          });
      }
      continue;
    }
    const bounds = partBounds(parts);
    const dims = [bounds.x2 - bounds.x1, bounds.y2 - bounds.y1, bounds.z2 - bounds.z1];
    const compound = !!c?.solidParts;
    if (compound) shaped++;
    else if (
      dims
        .slice()
        .sort((a, b) => a - b)
        .every((n, i) => Math.abs(n - [65, 120, 250][i]) < 1e-5)
    )
      full++;
    else rectangular++;
    const push = (kind: MasonryIssue["kind"], value: number) =>
      issues.push({ key: `${kind}:${b.id}`, kind, row: b.row, ids: [b.id], dimensions: dims, value });
    if (!stockFits(dims)) push("stock", Math.max(...dims));
    if (Math.min(...dims) < THIN_PART_MM - 1e-5) push("thin", Math.min(...dims));
    else if (compound) {
      // Do not hide a thin shoulder by assigning its volumes a shared ID.
      const smallest = Math.min(...parts.map((p) => Math.min(p.x2 - p.x1, p.y2 - p.y1, p.z2 - p.z1)));
      if (smallest < THIN_PART_MM - 1e-5) push("cut-detail", smallest);
    }
  }
  issues.push(...alignedJoints(masonry));
  issues.sort((a, b) => a.row - b.row || a.kind.localeCompare(b.kind) || a.ids[0].localeCompare(b.ids[0]));
  return { total: masonry.length, full, rectangular, shaped, volumeM3: volumeMm3 / 1e9, issues };
}

type Seam = { axis: "x" | "y"; coordinate: number; start: number; end: number; ids: string[]; row: number };
/** Screening only: coincident 5 mm vertical joints across consecutive courses.
 * Arches and cut brick interiors are excluded; no strength approval is inferred. */
function alignedJoints(bricks: PlacedBrick[]): MasonryIssue[] {
  const rows = new Map<number, PlacedBrick[]>();
  for (const b of bricks) {
    const list = rows.get(b.row) ?? [];
    list.push(b);
    rows.set(b.row, list);
  }
  const seams = new Map<number, Seam[]>();
  for (const [row, parts] of rows) seams.set(row, verticalJoints(parts));
  const issues: MasonryIssue[] = [];
  for (const [row, current] of seams)
    for (const a of current)
      for (const b of seams.get(row - 1) ?? []) {
        const overlap = Math.min(a.end, b.end) - Math.max(a.start, b.start);
        if (a.axis === b.axis && Math.abs(a.coordinate - b.coordinate) < 1 && overlap >= 60)
          issues.push({
            key: `bond:${row}:${a.ids.join(":")}:${b.ids.join(":")}`,
            kind: "bond",
            row,
            ids: [...a.ids, ...b.ids],
            dimensions: [],
            value: overlap
          });
      }
  return issues;
}
