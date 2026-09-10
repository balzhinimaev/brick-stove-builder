import { CLASSIC_RUSSIAN_STOVE } from "../../domain/classicRussianStove";
import { brickPhysicalSolids, solidPolyhedron } from "../../domain/geometry";
import type { PlacedBrick } from "../../domain/types";

export const CLASSIC_ARCH_NAMES = ["Большое подпечье", "Малое подпечье", "Арка устья", "Свод горнила"] as const;
export type ArchName = (typeof CLASSIC_ARCH_NAMES)[number];
export const archAddress = (b: PlacedBrick) => {
  const match = b.custom?.name.match(/^(.*?) · клин (\d+) · пояс (\d+)$/);
  return match ? { name: match[1], radial: Number(match[2]), bay: Number(match[3]) } : null;
};
export const physicalVertices = (b: PlacedBrick) =>
  brickPhysicalSolids(b).flatMap((s) => solidPolyhedron(s, (b.row - 1) * 70).vertices);

/** Read-only projection of actual document parts. No editor actions or synthetic bricks. */
export function classicArchAssembly(document: PlacedBrick[], name: ArchName) {
  const wedges = document.filter((b) => archAddress(b)?.name === name);
  if (!wedges.length) return null;
  const original = Object.values(CLASSIC_RUSSIAN_STOVE.rows)
    .flat()
    .filter((b) => archAddress(b)?.name === name);
  const first = wedges.find((b) => b.id === original[0]?.id);
  const offsetMm = {
    x: first ? (first.x - original[0].x) * 125 : 0,
    y: first ? (first.y - original[0].y) * 125 : 0
  };
  // Fixed-source timber must never pretend to fit a removed or edited arch.
  // A common plan translation (calculator positioning) does preserve that timber.
  if (
    original.length !== wedges.length ||
    original.some((b) => {
      const actual = wedges.find((part) => part.id === b.id);
      if (!actual) return true;
      const expected = physicalVertices(b);
      const points = physicalVertices(actual);
      return (
        points.length !== expected.length ||
        points.some(
          (p, i) =>
            Math.abs(p.x - expected[i].x - offsetMm.x) > 1e-6 ||
            Math.abs(p.y - expected[i].y - offsetMm.y) > 1e-6 ||
            Math.abs(p.z - expected[i].z) > 1e-6
        )
      );
    })
  )
    return null;
  const n = Math.max(...wedges.map((b) => archAddress(b)!.radial));
  const points = wedges.flatMap(physicalVertices);
  const bounds = (axis: "x" | "y" | "z") => [
    Math.min(...points.map((p) => p[axis])),
    Math.max(...points.map((p) => p[axis]))
  ];
  const [x1, x2] = bounds("x"),
    [y1, y2] = bounds("y"),
    [spring] = bounds("z");
  const infill = document.filter((b) => b.custom?.name === `${name} · пята / пазуха`);
  const heels = infill.filter((b) => Math.min(...physicalVertices(b).map((p) => p.z)) <= spring + 1);
  const supports = document.filter((b) => {
    if (b.kind !== "custom" || CLASSIC_ARCH_NAMES.some((node) => b.custom?.name.startsWith(`${node} ·`))) return false;
    const v = physicalVertices(b);
    return (
      v.every((p) => p.z <= spring + 1 && p.z >= (name === "Свод горнила" || name === "Арка устья" ? 700 : 0)) &&
      Math.max(...v.map((p) => p.x)) >= x1 &&
      Math.min(...v.map((p) => p.x)) <= x2 &&
      Math.max(...v.map((p) => p.y)) >= y1 &&
      Math.min(...v.map((p) => p.y)) <= y2
    );
  });
  const steps: { label: string; parts: PlacedBrick[]; centering: boolean }[] = [
    { label: "Опорная кладка и пяты", parts: [...supports, ...heels], centering: false },
    { label: "Кружало и настил — временная деревянная опора", parts: [], centering: true }
  ];
  for (let radial = 1; radial <= (n + 1) / 2; radial++) {
    const pair = wedges.filter((b) => [radial, n + 1 - radial].includes(archAddress(b)!.radial));
    const bays = [...new Set(pair.map((b) => archAddress(b)!.bay))].sort((a, b) => a - b);
    for (const bay of bays)
      steps.push({
        label: `${radial === (n + 1) / 2 ? "Замок · вжимается в раствор" : `Симметричная пара ${radial}`} · продольный участок ${bay}`,
        parts: pair
          .filter((b) => archAddress(b)!.bay === bay)
          .sort((a, b) => archAddress(a)!.radial - archAddress(b)!.radial),
        centering: true
      });
  }
  steps.push(
    {
      label: "Свод замкнут · выдержка до полного высыхания раствора (условная стадия, не таймер)",
      parts: [],
      centering: true
    },
    { label: "Раствор полностью высох · снятие кружала и стоек", parts: [], centering: false }
  );
  steps.push({
    label: "Заполнение пазух после завершения свода",
    parts: infill.filter((b) => !heels.includes(b)),
    centering: false
  });
  const numbers = new Map(steps.flatMap((s) => s.parts).map((b, i) => [b.id, i + 1]));
  return { name, wedges, steps, numbers, offsetMm, bounds: { x1, x2, y1, y2, spring } };
}
export type ArchAssembly = NonNullable<ReturnType<typeof classicArchAssembly>>;
export function archAssemblyFrame(assembly: ArchAssembly, step: number) {
  const index = Math.max(0, Math.min(assembly.steps.length - 1, step));
  return {
    parts: assembly.steps.slice(0, index + 1).flatMap((s) => s.parts),
    active: assembly.steps[index].parts,
    centering: assembly.steps[index].centering,
    label: assembly.steps[index].label
  };
}
