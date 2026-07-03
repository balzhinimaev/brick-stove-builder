import React, { useMemo, useState } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera, Text } from "@react-three/drei";
import { COLORS } from "../../theme/colors";
import { BRICK_LAYER_HEIGHT } from "../../domain/constants";
import { brickWorldGeometry, cellToWorld, isInsideGrid, snapToStep } from "../../domain/geometry";
import { getToolColor } from "../../domain/tools";
import type { Translate } from "../../i18n";
import type { BrickKind, CameraState, CustomBrickSpec, GridSpec, NotchCorner, Orientation, PlacedBrick, SnapStep, ToolKind } from "../../domain/types";
import { ThreeBrick, ThreeDoor, ThreeGrate, ThreePlate, ThreeRebate } from "./ThreeBrick";

type HoverCell = { x: number; y: number } | null;

/** Lighting tuned to keep vent/cleanout faces readable without washing out brick color. */
const LIGHTING = {
  ambient: 1.35,
  hemisphere: 0.55,
  keyLight: 1.35,
  rimLight: 0.65
} as const;

export function ThreeStack({
  grid,
  bricks,
  currentRow,
  placeAt,
  t,
  camera,
  activeTool,
  orientation,
  notchCorner,
  snapStep,
  customBrick,
  plateSpec,
  doorSpec
}: {
  grid: GridSpec;
  bricks: PlacedBrick[];
  currentRow: number;
  placeAt: (x: number, y: number, exactX?: number, exactY?: number) => void;
  t: Translate;
  camera: CameraState;
  activeTool: ToolKind;
  orientation: Orientation;
  notchCorner: NotchCorner;
  snapStep: SnapStep;
  customBrick: CustomBrickSpec | null;
  plateSpec: CustomBrickSpec;
  doorSpec: CustomBrickSpec;
}) {
  const [hoverCell3d, setHoverCell3d] = useState<HoverCell>(null);
  const sorted = useMemo(() => [...bricks].sort((a, b) => a.row - b.row || a.y - b.y || a.x - b.x), [bricks]);
  const gridY = (currentRow - 1) * BRICK_LAYER_HEIGHT + 0.006;
  const unit = t("unitCm");
  return (
    <div className="relative h-[390px] overflow-hidden rounded-[22px] bg-[#FFF7E8] md:h-[460px] xl:h-[min(62dvh,780px)] 2xl:h-[min(68dvh,860px)]" aria-label={t("aria3d")}>
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-2xl border border-[#3D2B1F]/10 bg-[#F5E6C8]/90 px-3 py-2 text-xs font-black shadow-sm">{t("view3d")} · {grid.widthCm}×{grid.lengthCm} {unit}</div>
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, powerPreference: "high-performance" }}>
        <color attach="background" args={[COLORS.skyCream]} />
        <ambientLight intensity={LIGHTING.ambient} />
        <hemisphereLight intensity={LIGHTING.hemisphere} color={COLORS.skyCream} groundColor={COLORS.foundation} />
        <directionalLight
          position={[4, 8, 5]}
          intensity={LIGHTING.keyLight}
          castShadow
          shadow-bias={-0.00005}
          shadow-normalBias={0.03}
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight position={[-6, 4.5, -4]} intensity={LIGHTING.rimLight} />
        <OrthographicCamera makeDefault position={[Math.max(grid.cols, 6.8), 6.2, Math.max(grid.rows, 7.2)]} zoom={(520 / Math.max(grid.cols, grid.rows, 10)) * camera.zoom} />
        <OrbitControls enableDamping dampingFactor={0.12} enableRotate enableZoom enablePan minZoom={25} maxZoom={120} target={[camera.offsetX, BRICK_LAYER_HEIGHT * currentRow * 0.45, camera.offsetY]} />
        <group rotation={[0, (camera.angle * Math.PI) / 180, 0]} position={[camera.offsetX, 0, camera.offsetY]}>
          <FoundationSlab grid={grid} />
          <ThreeGrid grid={grid} gridY={gridY} />
          <DimensionLabels grid={grid} gridY={gridY} unit={unit} />
          {sorted.map((brick) => <ThreeBrick key={brick.id} grid={grid} brick={brick} currentRow={currentRow} unit={unit} />)}
          <PlacementCells grid={grid} currentRow={currentRow} placeAt={placeAt} hoverCell={hoverCell3d} setHoverCell={setHoverCell3d} activeTool={activeTool} orientation={orientation} notchCorner={notchCorner} snapStep={snapStep} customBrick={customBrick} plateSpec={plateSpec} doorSpec={doorSpec} unit={unit} />
        </group>
      </Canvas>
    </div>
  );
}

function FoundationSlab({ grid }: { grid: GridSpec }) {
  return <mesh position={[0, -0.08, 0]} receiveShadow><boxGeometry args={[grid.cols + 0.4, 0.12, grid.rows + 0.4]} /><meshStandardMaterial color={COLORS.foundation} roughness={0.88} /></mesh>;
}

function ThreeGrid({ grid, gridY }: { grid: GridSpec; gridY: number }) {
  return (
    <group>
      {Array.from({ length: grid.cols + 1 }).map((_, x) => { const world = cellToWorld(x, 0, grid); return <mesh key={`grid-x-${x}`} position={[world.x, gridY, 0]}><boxGeometry args={[0.012, 0.012, grid.rows]} /><meshBasicMaterial color={COLORS.sageDark} transparent opacity={0.45} /></mesh>; })}
      {Array.from({ length: grid.rows + 1 }).map((_, z) => { const world = cellToWorld(0, z, grid); return <mesh key={`grid-z-${z}`} position={[0, gridY, world.z]}><boxGeometry args={[grid.cols, 0.012, 0.012]} /><meshBasicMaterial color={COLORS.sageDark} transparent opacity={0.45} /></mesh>; })}
    </group>
  );
}

function DimensionLabels({ grid, gridY, unit }: { grid: GridSpec; gridY: number; unit: string }) {
  return (
    <group>
      <Text position={[0, gridY + 0.04, grid.rows / 2 + 0.48]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.22} color={COLORS.charcoal} anchorX="center" anchorY="middle">{grid.widthCm} {unit}</Text>
      <Text position={[-grid.cols / 2 - 0.5, gridY + 0.04, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} fontSize={0.22} color={COLORS.charcoal} anchorX="center" anchorY="middle">{grid.lengthCm} {unit}</Text>
      {Array.from({ length: grid.cols + 1 }).map((_, x) => { const world = cellToWorld(x, grid.rows, grid); return <Text key={`x-label-${x}`} position={[world.x, gridY + 0.04, world.z + 0.18]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.14} color={COLORS.sageDark}>{Math.round((x * grid.widthCm) / grid.cols)}</Text>; })}
      {Array.from({ length: grid.rows + 1 }).map((_, z) => { const world = cellToWorld(0, z, grid); return <Text key={`z-label-${z}`} position={[-grid.cols / 2 - 0.22, gridY + 0.04, world.z]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} fontSize={0.14} color={COLORS.sageDark}>{Math.round((z * grid.lengthCm) / grid.rows)}</Text>; })}
    </group>
  );
}

function PlacementCells({
  grid,
  currentRow,
  placeAt,
  hoverCell,
  setHoverCell,
  activeTool,
  orientation,
  notchCorner,
  snapStep,
  customBrick,
  plateSpec,
  doorSpec,
  unit
}: {
  grid: GridSpec;
  currentRow: number;
  placeAt: (x: number, y: number, exactX?: number, exactY?: number) => void;
  hoverCell: HoverCell;
  setHoverCell: React.Dispatch<React.SetStateAction<HoverCell>>;
  activeTool: ToolKind;
  orientation: Orientation;
  notchCorner: NotchCorner;
  snapStep: SnapStep;
  customBrick: CustomBrickSpec | null;
  plateSpec: CustomBrickSpec;
  doorSpec: CustomBrickSpec;
  unit: string;
}) {
  const gridY = (currentRow - 1) * BRICK_LAYER_HEIGHT + 0.02;
  const previewKind: BrickKind = activeTool === "eraser" ? "cut" : activeTool;
  const previewOrientation: Orientation = activeTool === "eraser" ? "h" : orientation;

  // Точка пересечения луча с плоскостью → локальные координаты → узел сетки по шагу.
  const cellFromEvent = (event: ThreeEvent<MouseEvent>) => {
    const local = event.object.worldToLocal(event.point.clone());
    const rawX = local.x + grid.cols / 2;
    const rawY = local.z + grid.rows / 2;
    return {
      x: snapToStep(rawX, snapStep, grid.cols),
      y: snapToStep(rawY, snapStep, grid.rows),
      rawX,
      rawY
    };
  };

  return (
    <group>
      {hoverCell ? (() => {
        if (previewKind === "custom" && !customBrick) return null;
        const draft = { id: "hover", row: currentRow, x: hoverCell.x, y: hoverCell.y, kind: previewKind, orientation: previewOrientation, notchCorner: previewKind === "rebate" ? notchCorner : undefined, custom: previewKind === "custom" ? customBrick ?? undefined : previewKind === "plate" ? plateSpec : previewKind === "cleanout" ? doorSpec : undefined } as PlacedBrick;
        const geom = brickWorldGeometry(draft, grid);
        const fits = activeTool === "eraser" ? true : isInsideGrid(draft, grid);
        const color = activeTool === "eraser" ? "#c94f4f" : getToolColor(previewKind);

        return (
          <group>
            {previewKind === "grate"
              ? <ThreeGrate grid={grid} brick={draft} currentRow={currentRow} opacity={fits ? 0.42 : 0.22} unit={unit} />
              : previewKind === "rebate" || previewKind === "custom"
              ? <ThreeRebate grid={grid} brick={draft} currentRow={currentRow} opacity={fits ? 0.42 : 0.22} />
              : previewKind === "plate"
              ? <ThreePlate grid={grid} brick={draft} currentRow={currentRow} opacity={fits ? 0.42 : 0.22} />
              : previewKind === "cleanout"
              ? <ThreeDoor grid={grid} brick={draft} currentRow={currentRow} opacity={fits ? 0.42 : 0.22} />
              : (
                <mesh position={[geom.position[0], gridY + geom.scale[1] / 2, geom.position[2]]}>
                  <boxGeometry args={[geom.scale[0], Math.max(0.06, geom.scale[1] * 0.65), geom.scale[2]]} />
                  <meshStandardMaterial color={color} transparent opacity={fits ? 0.35 : 0.22} />
                </mesh>
              )}
            <Text position={[geom.position[0], gridY + Math.max(0.08, geom.scale[1] * 0.75), geom.position[2]]} fontSize={0.22} color={fits ? "#2f5d38" : "#9b2c2c"} anchorX="center" anchorY="middle">{activeTool === "eraser" ? "−" : previewOrientation === "h" ? "+ H" : "+ V"}</Text>
          </group>
        );
      })() : null}

      {/* Единая невидимая плоскость приёма кликов: одна вместо cols×rows плоскостей,
          координата снапится к текущему шагу (целая ячейка или полячейки). */}
      <mesh
        position={[0, gridY, 0]}
        onPointerMove={(event) => {
          event.stopPropagation();
          const cell = cellFromEvent(event);
          setHoverCell((prev) => (prev && prev.x === cell.x && prev.y === cell.y ? prev : cell));
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => { setHoverCell(null); document.body.style.cursor = "default"; }}
        onClick={(event) => {
          event.stopPropagation();
          const cell = cellFromEvent(event);
          placeAt(cell.x, cell.y, cell.rawX, cell.rawY);
        }}
      >
        <boxGeometry args={[grid.cols, 0.012, grid.rows]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
