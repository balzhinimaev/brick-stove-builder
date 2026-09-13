import { solidPartsError } from "../../shared/solidParts.js";
import type { CustomBrickSpec, PlacedBrick } from "./types";

export const MASONRY_JOINT_MM = 5;
/** Workshop review threshold, NOT a regulatory minimum. */
export const THIN_PART_MM = 25;
type Part = NonNullable<CustomBrickSpec["solidParts"]>[number];
export type Segment = { start: number; length: number };

/** Full stock first; redistribute a small closure instead of emitting a sliver.
 * Reverse alternating runs so residual cuts do not always collect at one end. */
export function stockSegments(
  length: number,
  stock: number,
  reverse = false,
  stagger: boolean | number = false
): Segment[] {
  if (!(length > 0) || !(stock > 0)) return [];
  const starter = typeof stagger === "number" ? stagger : 120;
  if (stagger && stock === 250 && length > (typeof stagger === "number" ? starter + 65 : stock + 60)) {
    const segments = [
      { start: 0, length: starter },
      ...stockSegments(length - starter - 5, stock).map((s) => ({ ...s, start: s.start + starter + 5 }))
    ];
    return reverse ? segments.map((s) => ({ ...s, start: length - s.start - s.length })).reverse() : segments;
  }
  const count = Math.max(1, Math.ceil((length + MASONRY_JOINT_MM - 1e-6) / (stock + MASONRY_JOINT_MM)));
  const lengths = Array<number>(count).fill(stock);
  lengths[count - 1] = length - (count - 1) * (stock + MASONRY_JOINT_MM);
  if (count > 1 && lengths[count - 1] < Math.min(60, stock / 2)) {
    // Same occupied length and number of joints, two practical end cuts.
    const total = lengths[count - 2] + lengths[count - 1];
    lengths[count - 2] = Math.min(stock, Math.ceil(total / 2));
    lengths[count - 1] = total - lengths[count - 2];
  }
  if (reverse) lengths.reverse();
  let start = 0;
  return lengths.map((length) => {
    const segment = { start, length };
    start += length + MASONRY_JOINT_MM;
    return segment;
  });
}

/** Orient narrow walls along their length, not against a global checkerboard.
 * Alternate the starting bond on the long stock axis in adjacent courses. */
export function stockGrid(
  w: number,
  h: number,
  row: number,
  x = 0,
  y = 0,
  lower: Joint[] = [],
  neighbours: { x: number; y: number; w: number; h: number }[] = []
) {
  const targets = neighbours.filter(
    (b) =>
      Math.min(b.w, b.h) < THIN_PART_MM &&
      (((Math.abs(b.x + b.w - x) < 1e-6 || Math.abs(x + w - b.x) < 1e-6) &&
        Math.min(y + h, b.y + b.h) - Math.max(y, b.y) > 1e-6) ||
        ((Math.abs(b.y + b.h - y) < 1e-6 || Math.abs(y + h - b.y) < 1e-6) &&
          Math.min(x + w, b.x + b.w) - Math.max(x, b.x) > 1e-6))
  );
  const candidates = [
    [250, 120],
    [120, 250]
  ].flatMap(([dx, dy]) =>
    (targets.length ? [false, true, 60, 90] : [false, true]).flatMap((stagger) =>
      [false, true].flatMap((rx) =>
        [false, true].map((ry) => {
          const xs = stockSegments(w, dx, rx, stagger);
          const ys = stockSegments(h, dy, ry, stagger);
          let score = 0;
          // Prefer the nominal alternating bond when fabrication costs are equal.
          if (stagger !== (row % 2 === 0)) score += 0.001;
          for (const x of xs)
            for (const y of ys) {
              score += 0.1;
              if (Math.abs(x.length - dx) > 1e-6 || Math.abs(y.length - dy) > 1e-6) score += 1;
              if (Math.min(x.length, y.length) < THIN_PART_MM) score += 100;
            }
          for (const joint of lower) {
            const segments = joint.axis === "x" ? xs : ys;
            const start = joint.axis === "x" ? y : x,
              end = start + (joint.axis === "x" ? h : w);
            if (Math.min(end, joint.end) - Math.max(start, joint.start) < 60) continue;
            if (
              segments
                .slice(0, -1)
                .some((s) => Math.abs((joint.axis === "x" ? x : y) + s.start + s.length + 2.5 - joint.coordinate) < 1)
            )
              score += 1000;
          }
          // Choose a closure that can absorb a touching sliver as the shoulder
          // of ONE stock-sized brick. Do not enlarge the occupied wall contour.
          for (const b of targets) {
            const canJoin = xs.some((sx) =>
              ys.some((sy) => {
                const tile = {
                  x1: x + sx.start,
                  x2: x + sx.start + sx.length,
                  y1: y + sy.start,
                  y2: y + sy.start + sy.length
                };
                const spans = [
                  Math.min(tile.x2, b.x + b.w) - Math.max(tile.x1, b.x),
                  Math.min(tile.y2, b.y + b.h) - Math.max(tile.y1, b.y)
                ];
                if (!(spans.some((v) => Math.abs(v) < 1e-6) && spans.some((v) => v > 1e-6))) return false;
                const dims = [
                  Math.max(tile.x2, b.x + b.w) - Math.min(tile.x1, b.x),
                  Math.max(tile.y2, b.y + b.h) - Math.min(tile.y1, b.y),
                  65
                ].sort((a, b) => a - b);
                return dims.every((d, i) => d <= [65, 120, 250][i] + 1e-6);
              })
            );
            if (canJoin) score -= 2000;
          }
          return { xs, ys, score };
        })
      )
    )
  );
  return candidates.sort((a, b) => a.score - b.score)[0];
}

export type Joint = { axis: "x" | "y"; coordinate: number; start: number; end: number; ids: string[]; row: number };
/** Real 5 mm straight mortar gaps, never boundaries within a compound brick. */
export function verticalJoints(bricks: PlacedBrick[]): Joint[] {
  const parts = bricks.flatMap((brick) => {
    if (brick.custom?.solidParts) return [];
    const p = rectangularParts(brick);
    return p?.length === 1 && Math.abs(p[0].z1) < 1e-5 && Math.abs(p[0].z2 - 65) < 1e-5 ? [{ brick, b: p[0] }] : [];
  });
  const result: Joint[] = [];
  for (let i = 0; i < parts.length; i++)
    for (let j = i + 1; j < parts.length; j++) {
      const a = parts[i],
        b = parts[j];
      if (a.brick.row !== b.brick.row) continue;
      for (const axis of ["x", "y"] as const) {
        const other = axis === "x" ? "y" : "x";
        const [lo, hi] = a.b[`${axis}1`] < b.b[`${axis}1`] ? [a, b] : [b, a];
        const gap = hi.b[`${axis}1`] - lo.b[`${axis}2`];
        const start = Math.max(a.b[`${other}1`], b.b[`${other}1`]),
          end = Math.min(a.b[`${other}2`], b.b[`${other}2`]);
        if (Math.abs(gap - 5) < 1e-4 && end - start >= 60)
          result.push({
            axis,
            coordinate: (hi.b[`${axis}1`] + lo.b[`${axis}2`]) / 2,
            start,
            end,
            ids: [lo.brick.id, hi.brick.id],
            row: a.brick.row
          });
      }
    }
  return result;
}

/** Axis-aligned parts in absolute plan mm, elevation relative to their course. */
export function rectangularParts(brick: PlacedBrick): Part[] | null {
  if (brick.kind !== "custom" || !brick.custom || brick.custom.material || brick.custom.notch) return null;
  const c = brick.custom;
  const p = c.profileXZ;
  if (
    p &&
    (p.length !== 4 ||
      new Set(p.map((v) => v.x.toFixed(6))).size !== 2 ||
      new Set(p.map((v) => v.z.toFixed(6))).size !== 2)
  )
    return null;
  const parts = c.solidParts ?? [
    {
      x1: 0,
      y1: 0,
      x2: c.w * 125,
      y2: c.h * 125,
      z1: p ? Math.min(...p.map((v) => v.z)) : 0,
      z2: p ? Math.max(...p.map((v) => v.z)) : 65
    }
  ];
  return parts.map((a) =>
    brick.orientation === "h"
      ? { ...a, x1: brick.x * 125 + a.x1, x2: brick.x * 125 + a.x2, y1: brick.y * 125 + a.y1, y2: brick.y * 125 + a.y2 }
      : {
          ...a,
          x1: brick.x * 125 + c.h * 125 - a.y2,
          x2: brick.x * 125 + c.h * 125 - a.y1,
          y1: brick.y * 125 + a.x1,
          y2: brick.y * 125 + a.x2
        }
  );
}

export function partBounds(parts: Part[]) {
  return {
    x1: Math.min(...parts.map((p) => p.x1)),
    y1: Math.min(...parts.map((p) => p.y1)),
    z1: Math.min(...parts.map((p) => p.z1)),
    x2: Math.max(...parts.map((p) => p.x2)),
    y2: Math.max(...parts.map((p) => p.y2)),
    z2: Math.max(...parts.map((p) => p.z2))
  };
}

/** Collapse only exact rectangular unions, never bridge a mortar joint or void. */
function simplify(parts: Part[]): Part[] {
  const result = parts.map((p) => ({ ...p }));
  for (let i = 0; i < result.length; i++)
    for (let j = i + 1; j < result.length; j++) {
      const a = result[i],
        b = result[j];
      const axis = (["x", "y", "z"] as const).find(
        (k) =>
          (Math.abs(a[`${k}2`] - b[`${k}1`]) < 1e-6 || Math.abs(b[`${k}2`] - a[`${k}1`]) < 1e-6) &&
          (["x", "y", "z"] as const)
            .filter((v) => v !== k)
            .every((v) => Math.abs(a[`${v}1`] - b[`${v}1`]) < 1e-6 && Math.abs(a[`${v}2`] - b[`${v}2`]) < 1e-6)
      );
      if (axis) {
        result[i] = partBounds([a, b]);
        result.splice(j, 1);
        i = -1;
        break;
      }
    }
  return result;
}

/** One ID and stock blank for touching geometric fragments. Physical union is
 * unchanged; profiles, separate courses and pieces across joints are not glued. */
export function uniteCutBricks(bricks: PlacedBrick[]): PlacedBrick[] {
  const items = bricks.map((brick) => ({ brick, parts: rectangularParts(brick), removed: false }));
  // Small fragments first; avoid consuming a neighbour on an unrelated merge.
  const minSize = (p: Part[]) => {
    const b = partBounds(p);
    return Math.min(b.x2 - b.x1, b.y2 - b.y1, b.z2 - b.z1);
  };
  const order = items
    .map((_, i) => i)
    .sort(
      (a, b) =>
        (items[a].parts ? minSize(items[a].parts!) : Infinity) - (items[b].parts ? minSize(items[b].parts!) : Infinity)
    );
  for (const i of order) {
    const a = items[i];
    if (!a.parts) continue;
    for (let j = 0; j < items.length; j++) {
      const b = items[j];
      if (
        i === j ||
        !b.parts ||
        a.brick.row !== b.brick.row ||
        a.brick.custom?.name !== b.brick.custom?.name ||
        a.brick.custom?.cutFrom !== b.brick.custom?.cutFrom
      )
        continue;
      const bounds = partBounds([...a.parts, ...b.parts]);
      const dims = [bounds.x2 - bounds.x1, bounds.y2 - bounds.y1, bounds.z2 - bounds.z1].sort((a, b) => a - b);
      if (dims.some((d, k) => d > [65, 120, 250][k] + 1e-6)) continue;
      const parts = simplify([...a.parts, ...b.parts]);
      const local = parts.map((p) => ({
        ...p,
        x1: p.x1 - bounds.x1,
        x2: p.x2 - bounds.x1,
        y1: p.y1 - bounds.y1,
        y2: p.y2 - bounds.y1
      }));
      const custom: CustomBrickSpec = {
        name: a.brick.custom!.name,
        w: (bounds.x2 - bounds.x1) / 125,
        h: (bounds.y2 - bounds.y1) / 125,
        cutFrom: a.brick.custom!.cutFrom,
        solidParts: local
      };
      if (solidPartsError(custom)) continue;
      // A rectangle requires no compound data, except for its elevated Z range.
      if (parts.length === 1) {
        delete custom.solidParts;
        if (bounds.z1 !== 0 || Math.abs(bounds.z2 - 65) > 1e-6)
          custom.profileXZ = [
            { x: 0, z: bounds.z1 },
            { x: custom.w * 125, z: bounds.z1 },
            { x: custom.w * 125, z: bounds.z2 },
            { x: 0, z: bounds.z2 }
          ];
      }
      a.brick = { ...a.brick, orientation: "h", x: bounds.x1 / 125, y: bounds.y1 / 125, custom };
      a.parts = parts;
      b.parts = null;
      b.removed = true;
      j = -1;
    }
  }
  return items.filter((a) => !a.removed).map((a) => a.brick);
}
