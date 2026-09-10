import { brickPhysicalSolids, profilePolyhedron, polyhedronFaces } from "../../geometry";
import type { PlacedBrick } from "../../types";

/** Whole bounding volume, not a predeclared graph of permitted gas cells.
 * 10 mm finite-volume audit. Horizontal 5 mm bed mortar is sealed for ordinary
 * masonry only. Thin metal intersects voxels conservatively; never midpoint-only.
 * This is geometry/topology, not fluid dynamics or a proof of draft.
 */
export function classicVolume(bricks: PlacedBrick[], removedIds: string[] = [], sealArchMortar = true) {
  const step = 10,
    nx = 201,
    ny = 226,
    nz = 253,
    plane = nx * ny;
  const occupied = new Uint8Array(plane * nz);
  const idx = (x: number, y: number, z: number) => x + nx * y + plane * z;
  for (const b of bricks) {
    if (removedIds.includes(b.id)) continue;
    const profile = profilePolyhedron(b),
      faces = profile ? polyhedronFaces(profile) : null;
    const base = (b.row - 1) * 70;
    // Reconstruct ONLY mortar bed planes cut out of the arch, not a blanket
    // dilation of the soffit or the flues. This seals a real 5 mm joint, not air.
    const arch = [
      ["Большое подпечье", 800, 1750, 350, 170, 1],
      ["Малое подпечье", 120, 650, 210, 70, 0],
      ["Арка устья", 390, 810, 1050, 70, 0],
      ["Свод горнила", 120, 1080, 1050, 180, 0]
    ].find(([name]) => b.custom?.name.startsWith(`${name} ·`));
    const mortar = (f: NonNullable<typeof faces>[number]) => {
      if (!sealArchMortar || !arch) return 1e-7;
      const [, left, right, spring, rise, rotated] = arch as [string, number, number, number, number, number];
      const half = (right - left) / 2,
        radius = (half * half + rise * rise) / (2 * rise);
      const center = rotated
        ? { x: 0, y: 125 + (left + right) / 2, z: spring + rise - radius - base }
        : { x: 625 + (left + right) / 2, y: 0, z: spring + rise - radius - base };
      const axial = rotated ? Math.abs(f.normal.x) : Math.abs(f.normal.y);
      if (axial > 0.999) return 2.5 + 1e-7;
      if (!b.custom?.name.includes(" · клин")) return f.normal.z > 0.999 ? 5 + 1e-7 : 1e-7;
      const distance = Math.abs(
        f.normal.x * (center.x - f.point.x) + f.normal.y * (center.y - f.point.y) + f.normal.z * (center.z - f.point.z)
      );
      const angle = Math.asin(half / radius),
        n = Math.ceil((2 * angle * (radius + 120)) / 60) | 1;
      const extrados = (radius + 120) * Math.cos(angle / n) - 2.5;
      return Math.abs(distance - 2.5) < 1e-5 || Math.abs(distance - extrados) < 1e-5 ? 2.5 + 1e-7 : 1e-7;
    };
    const solids = profile
      ? [
          {
            box: {
              x1: Math.min(...profile.vertices.map((p) => p.x)) / 125,
              x2: Math.max(...profile.vertices.map((p) => p.x)) / 125,
              y1: Math.min(...profile.vertices.map((p) => p.y)) / 125,
              y2: Math.max(...profile.vertices.map((p) => p.y)) / 125
            },
            z1: Math.min(...profile.vertices.map((p) => p.z)),
            z2: Math.max(...profile.vertices.map((p) => p.z))
          }
        ]
      : brickPhysicalSolids(b);
    for (const s of solids) {
      const masonry = !["plate", "grate", "damper", "cleanout", "vent"].includes(b.kind);
      const x1 = Math.max(0, Math.floor((s.box.x1 * 125 - (arch && sealArchMortar ? 2.5 : 0)) / step)),
        x2 = Math.min(nx, Math.ceil((s.box.x2 * 125 + (arch && sealArchMortar ? 2.5 : 0)) / step));
      const y1 = Math.max(0, Math.floor((s.box.y1 * 125 - (arch && sealArchMortar ? 2.5 : 0)) / step)),
        y2 = Math.min(ny, Math.ceil((s.box.y2 * 125 + (arch && sealArchMortar ? 2.5 : 0)) / step));
      const z1 = Math.max(0, Math.floor((base + s.z1 - (arch && sealArchMortar ? 2.5 : 0)) / step)),
        z2 = Math.min(
          nz,
          Math.ceil((base + s.z2 + (masonry && (!profile || (arch && sealArchMortar)) ? 5 : 0)) / step)
        );
      for (let z = z1; z < z2; z++)
        for (let y = y1; y < y2; y++)
          for (let x = x1; x < x2; x++) {
            const p = { x: x * step + 5, y: y * step + 5, z: z * step + 5 - base };
            if (
              faces &&
              !faces.every(
                // Shared inclined faces must not become numerical pinhole leaks.
                (f) =>
                  f.normal.x * (p.x - f.point.x) + f.normal.y * (p.y - f.point.y) + f.normal.z * (p.z - f.point.z) <=
                  mortar(f)
              )
            )
              continue;
            occupied[idx(x, y, z)] = 1;
          }
    }
  }
  const at = (x: number, y: number, z: number) =>
    idx(Math.floor((x + 625) / step), Math.floor((y + 125) / step), Math.floor(z / step));
  const flood = (x: number, y: number, z: number) => {
    const start = at(x, y, z),
      seen = new Uint8Array(occupied.length),
      queue = new Int32Array(occupied.length);
    let head = 0,
      tail = 0;
    if (!occupied[start]) {
      queue[tail++] = start;
      seen[start] = 1;
    }
    while (head < tail) {
      const k = queue[head++],
        iz = Math.floor(k / plane),
        iy = Math.floor((k - iz * plane) / nx),
        ix = k % nx;
      const visit = (j: number) => {
        if (!occupied[j] && !seen[j]) {
          seen[j] = 1;
          queue[tail++] = j;
        }
      };
      if (ix > 0) visit(k - 1);
      if (ix < nx - 1) visit(k + 1);
      if (iy > 0) visit(k - nx);
      if (iy < ny - 1) visit(k + nx);
      if (iz > 0) visit(k - plane);
      if (iz < nz - 1) visit(k + plane);
    }
    return {
      count: tail,
      reaches: (x: number, y: number, z: number) => Boolean(seen[at(x, y, z)])
    };
  };
  return { flood, solid: (x: number, y: number, z: number) => Boolean(occupied[at(x, y, z)]) };
}
