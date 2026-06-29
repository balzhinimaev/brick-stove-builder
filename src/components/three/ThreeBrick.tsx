import { memo } from "react";
import { Text } from "@react-three/drei";
import { COLORS } from "../../theme/colors";
import { BRICK_LAYER_HEIGHT, BRICK_GAP } from "../../domain/constants";
import { brickSizeFor, brickWorldGeometry } from "../../domain/geometry";
import { getToolColor } from "../../domain/tools";
import type { GridSpec, PlacedBrick } from "../../domain/types";

export const ThreeBrick = memo(function ThreeBrick({ grid, brick, currentRow, unit }: { grid: GridSpec; brick: PlacedBrick; currentRow: number; unit: string }) {
  if (brick.kind === "grate") return <ThreeGrate grid={grid} brick={brick} currentRow={currentRow} unit={unit} />;

  const geometry = brickWorldGeometry(brick, grid);
  const color = getToolColor(brick.kind);
  const isCurrent = brick.row === currentRow;
  const label = brick.kind === "vent" ? "V" : brick.kind === "cleanout" ? "D" : "";
  return (
    <group>
      <mesh position={geometry.position} castShadow receiveShadow><boxGeometry args={geometry.scale} /><meshStandardMaterial color={color} roughness={0.82} metalness={0.02} /></mesh>
      <mesh position={[geometry.position[0], geometry.position[1] + geometry.scale[1] / 2 + 0.006, geometry.position[2]]}><boxGeometry args={[geometry.scale[0] * 0.96, 0.01, geometry.scale[2] * 0.08]} /><meshBasicMaterial color={COLORS.mortar} transparent opacity={0.65} /></mesh>
      {isCurrent && <mesh position={[geometry.position[0], geometry.position[1] + geometry.scale[1] / 2 + 0.014, geometry.position[2]]}><boxGeometry args={[geometry.scale[0] + 0.035, 0.018, geometry.scale[2] + 0.035]} /><meshBasicMaterial color={COLORS.sage} transparent opacity={0.23} /></mesh>}
      {label && <Text position={[geometry.position[0], geometry.position[1] + geometry.scale[1] / 2 + 0.025, geometry.position[2]]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.28} color={COLORS.cream} anchorX="center" anchorY="middle">{label}</Text>}
    </group>
  );
});

export function ThreeGrate({ grid, brick, currentRow, opacity = 1, unit }: { grid: GridSpec; brick: PlacedBrick; currentRow: number; opacity?: number; unit: string }) {
  const geometry = brickWorldGeometry(brick, grid);
  const grateSize = brickSizeFor("grate", brick.orientation);
  // Grate should not inherit full brick mortar gaps; keep it almost flush with support cuts.
  const grateScaleX = Math.max(0.1, grateSize.w - BRICK_GAP * 0.12);
  const grateScaleZ = Math.max(0.1, grateSize.h - BRICK_GAP * 0.12);
  const grateHeight = BRICK_LAYER_HEIGHT * 0.22; // thinner cast-iron grate profile
  const supportTopY = (brick.row - 0.5) * BRICK_LAYER_HEIGHT + (BRICK_LAYER_HEIGHT * 0.92) / 2;
  const grateSeatEmbed = 0.004; // tiny embed removes "floating" seam
  const grateY = supportTopY + grateHeight / 2 - grateSeatEmbed;
  const isCurrent = brick.row === currentRow;
  const bars = 5;
  const longX = grateScaleX >= grateScaleZ;
  const span = longX ? grateScaleZ : grateScaleX;
  const barSize = span / (bars * 1.7);
  const gap = (span - barSize * bars) / Math.max(1, bars - 1);
  const supportRailHeight = Math.max(0.02, grateHeight * 0.58);
  const supportRailWidth = 0.12;
  const supportRailY = supportTopY - supportRailHeight / 2;
  const halfX = grateScaleX / 2;
  const halfZ = grateScaleZ / 2;
  const alongXCm = brick.orientation === "h" ? 38 : 25.2;
  const alongZCm = brick.orientation === "h" ? 25.2 : 38;
  const topLabelY = grateY + grateHeight / 2 + 0.035;
  const labelOpacity = opacity >= 0.95 ? 1 : 0.55;

  return (
    <group>
      {/* Brick seat rails: visual quarter-cut support where the grate rests. */}
      {longX ? (
        <>
          <mesh position={[geometry.position[0], supportRailY, geometry.position[2] - halfZ + supportRailWidth / 2]} castShadow receiveShadow>
            <boxGeometry args={[grateScaleX, supportRailHeight, supportRailWidth]} />
            <meshStandardMaterial color={COLORS.cutBrick} roughness={0.88} metalness={0.02} transparent opacity={Math.min(1, opacity * 0.96)} />
          </mesh>
          <mesh position={[geometry.position[0], supportRailY, geometry.position[2] + halfZ - supportRailWidth / 2]} castShadow receiveShadow>
            <boxGeometry args={[grateScaleX, supportRailHeight, supportRailWidth]} />
            <meshStandardMaterial color={COLORS.cutBrick} roughness={0.88} metalness={0.02} transparent opacity={Math.min(1, opacity * 0.96)} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[geometry.position[0] - halfX + supportRailWidth / 2, supportRailY, geometry.position[2]]} castShadow receiveShadow>
            <boxGeometry args={[supportRailWidth, supportRailHeight, grateScaleZ]} />
            <meshStandardMaterial color={COLORS.cutBrick} roughness={0.88} metalness={0.02} transparent opacity={Math.min(1, opacity * 0.96)} />
          </mesh>
          <mesh position={[geometry.position[0] + halfX - supportRailWidth / 2, supportRailY, geometry.position[2]]} castShadow receiveShadow>
            <boxGeometry args={[supportRailWidth, supportRailHeight, grateScaleZ]} />
            <meshStandardMaterial color={COLORS.cutBrick} roughness={0.88} metalness={0.02} transparent opacity={Math.min(1, opacity * 0.96)} />
          </mesh>
        </>
      )}

      {/* Corner chamfers to avoid the "floating rectangle" look. */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1]
      ].map(([sx, sz], i) => (
        <mesh
          key={`seat-corner-${i}`}
          position={[geometry.position[0] + sx * (halfX - 0.06), supportTopY - 0.012, geometry.position[2] + sz * (halfZ - 0.06)]}
          rotation={[0, Math.PI / 4, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.09, 0.024, 0.09]} />
          <meshStandardMaterial color={COLORS.cutBrick} roughness={0.9} metalness={0.02} transparent opacity={Math.min(1, opacity * 0.94)} />
        </mesh>
      ))}

      {Array.from({ length: bars }).map((_, i) => {
        const offset = -span / 2 + barSize / 2 + i * (barSize + gap);
        const position: [number, number, number] = longX
          ? [geometry.position[0], grateY, geometry.position[2] + offset]
          : [geometry.position[0] + offset, grateY, geometry.position[2]];
        const args: [number, number, number] = longX
          ? [grateScaleX, grateHeight, Math.max(0.04, barSize)]
          : [Math.max(0.04, barSize), grateHeight, grateScaleZ];
        return <mesh key={i} position={position} castShadow receiveShadow><boxGeometry args={args} /><meshStandardMaterial color={COLORS.grate} roughness={0.58} metalness={0.42} transparent opacity={opacity} /></mesh>;
      })}

      {isCurrent && <mesh position={[geometry.position[0], topLabelY + 0.002, geometry.position[2]]}><boxGeometry args={[grateScaleX + 0.05, 0.012, grateScaleZ + 0.05]} /><meshBasicMaterial color={COLORS.sage} transparent opacity={0.16} /></mesh>}
      <Text position={[geometry.position[0], topLabelY + 0.03, geometry.position[2]]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.16} color="#f4e3c4" anchorX="center" anchorY="middle" fillOpacity={labelOpacity}>РУ {brick.orientation === "h" ? "380×252×22 мм" : "252×380×22 мм"}</Text>

      <mesh position={[geometry.position[0], topLabelY, geometry.position[2] - grateScaleZ / 2 - 0.22]}>
        <boxGeometry args={[grateScaleX, 0.012, 0.018]} />
        <meshBasicMaterial color={COLORS.sageDark} transparent opacity={labelOpacity * 0.75} />
      </mesh>
      <Text position={[geometry.position[0], topLabelY + 0.012, geometry.position[2] - grateScaleZ / 2 - 0.32]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.14} color={COLORS.sageDark} anchorX="center" anchorY="middle" fillOpacity={labelOpacity}>{alongXCm.toLocaleString("ru-RU")} {unit}</Text>
      <mesh position={[geometry.position[0] - grateScaleX / 2 - 0.22, topLabelY, geometry.position[2]]}>
        <boxGeometry args={[0.018, 0.012, grateScaleZ]} />
        <meshBasicMaterial color={COLORS.sageDark} transparent opacity={labelOpacity * 0.75} />
      </mesh>
      <Text position={[geometry.position[0] - grateScaleX / 2 - 0.32, topLabelY + 0.012, geometry.position[2]]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} fontSize={0.14} color={COLORS.sageDark} anchorX="center" anchorY="middle" fillOpacity={labelOpacity}>{alongZCm.toLocaleString("ru-RU")} {unit}</Text>
    </group>
  );
}
