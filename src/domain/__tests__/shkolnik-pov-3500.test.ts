import { describe, expect, it } from "vitest";
import { POV3500_SOURCE, SHKOLNIK_POV_3500 } from "../shkolnikPov3500";
import { BUILTIN_SHOWCASE_PROJECTS } from "../showcaseProjects";
import { brickPhysicalSolids, convexIntersects, overlaps3D, solidPolyhedron, translatedPolyhedron } from "../geometry";

describe("Shkolnik POV-3500", () => {
  it("is a distinct 30-course public project with sourced dimensions", () => {
    expect(SHKOLNIK_POV_3500.id).toBe("shkolnik-pov-3500");
    expect(SHKOLNIK_POV_3500.rowCount).toBe(30);
    expect(Object.keys(SHKOLNIK_POV_3500.rows)).toHaveLength(30);
    expect(POV3500_SOURCE.bodyMm).toEqual([1020, 770, 2100]);
    expect(POV3500_SOURCE.circuits).toEqual(["winter-mixed", "summer-bypass"]);
    expect(BUILTIN_SHOWCASE_PROJECTS.map((project) => project.id)).toContain("shkolnik-pov-3500");
  });

  it("contains the functional hardware named in fig. 107", () => {
    const bricks = Object.values(SHKOLNIK_POV_3500.rows).flat();
    const names = bricks.map((brick) => brick.custom?.name ?? "");
    expect(names).toContain("Плита 710×410 · две конфорки");
    expect(names).toContain("Сушильный шкаф 510×380");
    expect(names).toContain("Задвижка зимнего хода");
    expect(names).toContain("Задвижка летнего хода");
    expect(names).toContain("Самоварник");
    expect(bricks.filter((brick) => brick.kind === "damper").map((brick) => brick.damperOpen)).toEqual([1, 0]);
    expect(bricks.find((brick) => brick.kind === "grate")?.row).toBe(6);
    expect(bricks.find((brick) => brick.kind === "plate")?.row).toBe(10);
  });

  it("does not replace either existing Russian stove", () => {
    expect(BUILTIN_SHOWCASE_PROJECTS.map((project) => project.id).slice(0, 2)).toEqual([
      "russian-stove-hob",
      "classic-russian-stove-hob"
    ]);
  });

  it("has no overlapping occupied solids", () => {
    for (const bricks of Object.values(SHKOLNIK_POV_3500.rows)) {
      for (const [index, brick] of bricks.entries()) {
        for (const next of bricks.slice(index + 1)) {
          expect(overlaps3D(brick, next), `${brick.id} overlaps ${next.id} in row ${brick.row}`).toBe(false);
        }
      }
    }
  });

  it("has no positive-volume intersections across course heights", () => {
    const bricks = Object.values(SHKOLNIK_POV_3500.rows).flat();
    const shapes = bricks.flatMap((brick) =>
      brickPhysicalSolids(brick).map((solid) => {
        const shape = translatedPolyhedron(solidPolyhedron(solid), (brick.row - 1) * 70);
        const bounds = (["x", "y", "z"] as const).map((axis) => [
          Math.min(...shape.vertices.map((point) => point[axis])),
          Math.max(...shape.vertices.map((point) => point[axis]))
        ]);
        return { brick, shape, bounds };
      })
    );
    const collisions: string[] = [];
    for (let i = 0; i < shapes.length; i++) {
      for (let j = i + 1; j < shapes.length; j++) {
        const a = shapes[i];
        const b = shapes[j];
        if (
          a.brick.id !== b.brick.id &&
          a.bounds.every(
            ([lo, hi], axis) => Math.min(hi, b.bounds[axis][1]) - Math.max(lo, b.bounds[axis][0]) > 1e-6
          ) &&
          convexIntersects(a.shape, b.shape)
        ) {
          collisions.push(`${a.brick.id} r${a.brick.row} / ${b.brick.id} r${b.brick.row}`);
        }
      }
    }
    expect(collisions).toEqual([]);
  }, 30000);

  it("supports every masonry piece from the preceding course", () => {
    const masonry = Object.values(SHKOLNIK_POV_3500.rows)
      .flat()
      .filter((brick) => brick.kind === "custom")
      .map((brick) => {
        const solids = brickPhysicalSolids(brick).map((solid) =>
          translatedPolyhedron(solidPolyhedron(solid), (brick.row - 1) * 70)
        );
        const vertices = solids.flatMap((solid) => solid.vertices);
        return {
          brick,
          bounds: {
            x1: Math.min(...vertices.map((point) => point.x)),
            x2: Math.max(...vertices.map((point) => point.x)),
            y1: Math.min(...vertices.map((point) => point.y)),
            y2: Math.max(...vertices.map((point) => point.y)),
            z1: Math.min(...vertices.map((point) => point.z)),
            z2: Math.max(...vertices.map((point) => point.z))
          }
        };
      });
    const unsupported = masonry.filter(({ brick, bounds }) => {
      if (brick.custom?.material === "steel") return false;
      if (brick.row === 1) return false;
      return !masonry.some(({ brick: below, bounds: support }) => {
        if (below.row !== brick.row - 1 || bounds.z1 - support.z2 > 5.01) return false;
        const dx = Math.min(bounds.x2, support.x2) - Math.max(bounds.x1, support.x1);
        const dy = Math.min(bounds.y2, support.y2) - Math.max(bounds.y1, support.y1);
        return dx > 1 && dy > 1 && dx * dy >= 100;
      });
    });
    expect(
      unsupported.map(
        ({ brick }) =>
          `${brick.id} r${brick.row} ${brick.custom?.name} @${brick.x * 125},${brick.y * 125} ${brick.custom?.w! * 125}×${brick.custom?.h! * 125}`
      )
    ).toEqual([]);
  });
});
