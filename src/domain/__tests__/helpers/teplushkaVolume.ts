import { brickPhysicalSolids, profilePolyhedron, polyhedronFaces } from "../../geometry";
import type { PlacedBrick } from "../../types";

/** Whole bounding volume, not a predeclared graph of permitted gas cells.
 * 10 mm finite-volume audit. Horizontal 5 mm bed mortar is sealed for ordinary
 * masonry only. Thin metal intersects voxels conservatively; never midpoint-only.
 * This is geometry/topology, not fluid dynamics or a proof of draft.
 */
export function teplushkaVolume(bricks: PlacedBrick[], removedIds: string[] = []) {
  const step = 10,
    nx = 151,
    ny = 151,
    nz = 233,
    plane = nx * ny;
  const occupied = new Uint8Array(plane * nz);
  const idx = (x: number, y: number, z: number) => x + nx * y + plane * z;
  for (const b of bricks) {
    if (removedIds.includes(b.id)) continue;
    const profile = profilePolyhedron(b),
      faces = profile ? polyhedronFaces(profile) : null;
    const base = (b.row - 1) * 70;
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
      const x1 = Math.max(0, Math.floor((s.box.x1 * 125) / step)),
        x2 = Math.min(nx, Math.ceil((s.box.x2 * 125) / step));
      const y1 = Math.max(0, Math.floor((s.box.y1 * 125) / step)),
        y2 = Math.min(ny, Math.ceil((s.box.y2 * 125) / step));
      const z1 = Math.max(0, Math.floor((base + s.z1) / step)),
        z2 = Math.min(nz, Math.ceil((base + s.z2 + (masonry && !profile ? 5 : 0)) / step));
      for (let z = z1; z < z2; z++)
        for (let y = y1; y < y2; y++)
          for (let x = x1; x < x2; x++) {
            const p = { x: x * step + 5, y: y * step + 5, z: z * step + 5 - base };
            if (
              faces &&
              !faces.every(
                (f) =>
                  f.normal.x * (p.x - f.point.x) + f.normal.y * (p.y - f.point.y) + f.normal.z * (p.z - f.point.z) <= 0
              )
            )
              continue;
            occupied[idx(x, y, z)] = 1;
          }
    }
  }
  const at = (x: number, y: number, z: number) =>
    idx(Math.floor((x + 125) / step), Math.floor((y + 125) / step), Math.floor(z / step));
  const flood = (x: number, y: number, z: number) => {
    const start = at(x, y, z),
      seen = new Uint8Array(occupied.length),
      queue = new Int32Array(occupied.length);
    const parent = new Int32Array(occupied.length);
    parent.fill(-1);
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
          parent[j] = k;
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
      path: (x: number, y: number, z: number) => {
        let k = at(x, y, z);
        const points: number[][] = [];
        while (k !== -1) {
          const iz = Math.floor(k / plane),
            iy = Math.floor((k - iz * plane) / nx),
            ix = k % nx;
          points.push([ix * 10 + 5 - 125, iy * 10 + 5 - 125, iz * 10 + 5]);
          k = parent[k];
        }
        return points;
      },
      reaches: (x: number, y: number, z: number) => Boolean(seen[at(x, y, z)])
    };
  };
  return { flood, solid: (x: number, y: number, z: number) => Boolean(occupied[at(x, y, z)]) };
}
