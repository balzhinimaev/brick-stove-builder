import { Html } from "@react-three/drei";
import { useMemo } from "react";
import { Box3, Vector3 } from "three";
import type { GridSpec, PlacedBrick } from "../../domain/types";
import { archAddress, physicalVertices, type ArchAssembly } from "../builder/classicArchAssembly";
import { BrickHighlight } from "./ThreeBrick";

export function archSceneBounds(parts: PlacedBrick[], grid: GridSpec) {
  return new Box3().setFromPoints(
    parts
      .flatMap(physicalVertices)
      .map((p) => new Vector3(p.x / 125 - grid.cols / 2, p.z / 125, p.y / 125 - grid.rows / 2))
  );
}

/** Timber meshes only: never PlacedBrick, persistence, materials or gas geometry. */
export function ArchCentering({ assembly, grid }: { assembly: ArchAssembly; grid: GridSpec }) {
  const specs: Record<string, number[]> = {
    "Большое подпечье": [800, 1750, 350, 170, 120, 1080, 65, 1],
    "Малое подпечье": [120, 650, 210, 70, 0, 650, 65, 0],
    "Арка устья": [390, 810, 1050, 70, 520, 130, 765, 0],
    "Свод горнила": [120, 1080, 1050, 180, 650, 1230, 765, 0]
  };
  const [left, right, spring, rise, axial, depth, floor, rotated] = specs[assembly.name];
  const half = (right - left) / 2,
    radius = (half * half + rise * rise) / (2 * rise),
    angle = Math.asin(half / radius);
  const count = Math.max(...assembly.wedges.map((b) => archAddress(b)!.radial));
  const center = (left + right) / 2;
  const position: [number, number, number] = rotated
    ? [(625 + axial + depth / 2) / 125 - grid.cols / 2, 0, (125 + center) / 125 - grid.rows / 2]
    : [(625 + center) / 125 - grid.cols / 2, 0, (125 + axial + depth / 2) / 125 - grid.rows / 2];
  return (
    <group position={position} rotation={[0, rotated ? -Math.PI / 2 : 0, 0]} name="view-only-centering">
      {Array.from({ length: count }, (_, i) => {
        const a = -angle + ((i + 0.5) * 2 * angle) / count;
        const r = radius * Math.cos(angle / count) - 10;
        return (
          <mesh
            key={`board-${a}`}
            position={[(r * Math.sin(a)) / 125, (spring + rise - radius + r * Math.cos(a)) / 125, 0]}
            rotation={[0, 0, -a]}
          >
            <boxGeometry args={[(2 * radius * Math.sin(angle / count)) / 125, 20 / 125, depth / 125]} />
            <meshStandardMaterial color="#bc995f" roughness={1} />
          </mesh>
        );
      })}
      {Array.from({ length: count }, (_, i) => -angle + ((i + 0.5) * 2 * angle) / count).flatMap((a) =>
        [-1, 1].map((end) => (
          <mesh
            key={`rib-${a}-${end}`}
            position={[
              ((radius * Math.cos(angle / count) - 60) * Math.sin(a)) / 125,
              (spring + rise - radius + (radius * Math.cos(angle / count) - 60) * Math.cos(a)) / 125,
              (end * (depth / 2 - 30)) / 125
            ]}
            rotation={[0, 0, -a]}
          >
            <boxGeometry args={[(2 * (radius - 20) * Math.sin(angle / count)) / 125, 80 / 125, 40 / 125]} />
            <meshStandardMaterial color="#a67d49" roughness={1} />
          </mesh>
        ))
      )}
      {[-1, 1].flatMap((side) =>
        [-1, 1].map((end) => {
          const x = side * half * 0.65,
            top = spring + rise - radius + Math.sqrt(radius * radius - x * x) - 70;
          return (
            <mesh key={`${side}-${end}`} position={[x / 125, (floor + top) / 250, (end * (depth / 2 - 30)) / 125]}>
              <boxGeometry args={[40 / 125, (top - floor) / 125, 40 / 125]} />
              <meshStandardMaterial color="#947043" roughness={1} />
            </mesh>
          );
        })
      )}
    </group>
  );
}

export function ArchPartLabels({
  parts,
  assembly,
  grid,
  selectedId,
  onSelect
}: {
  parts: PlacedBrick[];
  assembly: ArchAssembly;
  grid: GridSpec;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const labels = useMemo(
    () => parts.map((brick) => ({ brick, center: archSceneBounds([brick], grid).getCenter(new Vector3()) })),
    [parts, grid]
  );
  return (
    <>
      {labels.map(({ brick, center }) => (
        <Html key={brick.id} position={center} center zIndexRange={[20, 0]}>
          <button
            type="button"
            className="arch-part-number"
            aria-pressed={selectedId === brick.id}
            title={`${brick.custom?.name} · ${brick.id}`}
            onClick={() => onSelect(brick.id)}
          >
            {assembly.numbers.get(brick.id)}
          </button>
        </Html>
      ))}
      {parts
        .filter((b) => b.id === selectedId)
        .map((brick) => (
          <BrickHighlight key={brick.id} brick={brick} grid={grid} color="#1685ac" />
        ))}
    </>
  );
}
