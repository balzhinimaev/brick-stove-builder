import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera, Text } from "@react-three/drei";
import { COLORS } from "../../theme/colors";
import { BRICK_LAYER_HEIGHT } from "../../domain/constants";
import { BRICK_MM, brickWorldGeometry, cellToWorld, isInsideGrid, plateSeatZ, snapToStep } from "../../domain/geometry";
import { getToolColor } from "../../domain/tools";
import type { Translate } from "../../i18n";
import type { BrickKind, CameraState, CustomBrickSpec, GridSpec, NotchCorner, Orientation, PlacedBrick, SnapStep, ToolKind } from "../../domain/types";
import { ThreeBrick, ThreeDamper, ThreeDoor, ThreeGrate, ThreePlate, ThreeRebate } from "./ThreeBrick";

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
  canPlaceAt,
  rejectedIds,
  t,
  camera,
  activeTool,
  orientation,
  notchCorner,
  rebateDepthMm,
  snapStep,
  customBrick,
  plateSpec,
  doorSpec,
  damperSpec,
  grateSpec,
  onToggleDamper,
  onZoomDelta
}: {
  grid: GridSpec;
  bricks: PlacedBrick[];
  currentRow: number;
  placeAt: (x: number, y: number, exactX?: number, exactY?: number) => void;
  canPlaceAt: (x: number, y: number) => boolean;
  rejectedIds: ReadonlySet<string>;
  t: Translate;
  camera: CameraState;
  activeTool: ToolKind;
  orientation: Orientation;
  notchCorner: NotchCorner;
  rebateDepthMm: number;
  snapStep: SnapStep;
  customBrick: CustomBrickSpec | null;
  plateSpec: CustomBrickSpec;
  doorSpec: CustomBrickSpec;
  damperSpec: CustomBrickSpec;
  grateSpec: CustomBrickSpec;
  onToggleDamper?: (id: string) => void;
  /** Пошаговый зум из жестов (пинч/колесо) — тот же стейт, что у кнопок «+/−». */
  onZoomDelta?: (delta: number) => void;
}) {
  const [hoverCell3d, setHoverCell3d] = useState<HoverCell>(null);
  const sorted = useMemo(() => [...bricks].sort((a, b) => a.row - b.row || a.y - b.y || a.x - b.x), [bricks]);
  const gridY = (currentRow - 1) * BRICK_LAYER_HEIGHT + 0.006;
  const unit = t("unitCm");

  // Пинч и колесо. Зум канваса живёт ТОЛЬКО в React-стейте (enableZoom у
  // OrbitControls выключен) — до сих пор жесты никуда не были подключены и
  // масштабирование работало только кнопками «+/−».
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pinchDist = useRef<number | null>(null);
  const touchDist = (touches: React.TouchList) =>
    Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

  useEffect(() => {
    // колесо мыши: слушатель обязан быть non-passive, иначе preventDefault не
    // сработает и страница будет скроллить вместо зума
    const el = containerRef.current;
    if (!el || !onZoomDelta) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      onZoomDelta(event.deltaY < 0 ? 0.06 : -0.06);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onZoomDelta]);

  const handleTouchStart = (event: React.TouchEvent) => {
    if (event.touches.length === 2) pinchDist.current = touchDist(event.touches);
  };
  const handleTouchMove = (event: React.TouchEvent) => {
    if (event.touches.length !== 2 || pinchDist.current === null || !onZoomDelta) return;
    const dist = touchDist(event.touches);
    // ~35px разведения пальцев = один шаг кнопки зума
    const delta = (dist - pinchDist.current) / 440;
    if (Math.abs(delta) >= 0.02) {
      onZoomDelta(Number(delta.toFixed(3)));
      pinchDist.current = dist;
    }
  };
  const handleTouchEnd = (event: React.TouchEvent) => {
    if (event.touches.length < 2) pinchDist.current = null;
  };
  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className="relative h-[390px] overflow-hidden rounded-[22px] bg-[#FFF7E8] md:h-[460px] xl:h-[min(62dvh,780px)] 2xl:h-[min(68dvh,860px)]"
      aria-label={t("aria3d")}
    >
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
        {/* Оффсет панорамирования задаётся ТОЛЬКО камере и её цели (не группе сцены),
            иначе сдвиг group гасится сдвигом target и кнопки-стрелки ничего не двигают.
            Смещаем и позицию камеры, и target на один вектор — направление взгляда
            сохраняется, получается честный параллельный сдвиг. */}
        <OrthographicCamera makeDefault position={[Math.max(grid.cols, 6.8) + camera.offsetX, 6.2, Math.max(grid.rows, 7.2) + camera.offsetY]} zoom={(520 / Math.max(grid.cols, grid.rows, 10)) * camera.zoom} />
        {/* Zoom: единственный источник — React-стейт (кнопки/пинч UI) через zoom-проп
            камеры; enableZoom у OrbitControls выключен, чтобы контролы не мутировали
            camera.zoom в обход стейта (иначе любой ре-рендер сбрасывал их зум). */}
        <OrbitControls enableDamping dampingFactor={0.12} enableRotate enableZoom={false} enablePan target={[camera.offsetX, BRICK_LAYER_HEIGHT * currentRow * 0.45, camera.offsetY]} />
        <group rotation={[0, (camera.angle * Math.PI) / 180, 0]}>
          <FoundationSlab grid={grid} />
          <ThreeGrid grid={grid} gridY={gridY} />
          <DimensionLabels grid={grid} gridY={gridY} unit={unit} />
          {sorted.map((brick) => <ThreeBrick key={brick.id} grid={grid} brick={brick} currentRow={currentRow} unit={unit} onToggleDamper={onToggleDamper} />)}
          {/* вспышка отказа: красным подсвечиваются элементы, помешавшие установке
              (в т.ч. дверца из нижнего ряда — видно, ЧТО именно держит объём) */}
          {sorted.filter((brick) => rejectedIds.has(brick.id)).map((brick) => {
            const geom = brickWorldGeometry(brick, grid);
            return (
              <mesh key={`rej-${brick.id}`} position={geom.position}>
                <boxGeometry args={[geom.scale[0] + 0.08, geom.scale[1] + 0.08, geom.scale[2] + 0.08]} />
                <meshBasicMaterial color="#9b2c2c" transparent opacity={0.45} depthWrite={false} />
              </mesh>
            );
          })}
          <PlacementCells grid={grid} currentRow={currentRow} rowBricks={sorted.filter((brick) => brick.row === currentRow)} placeAt={placeAt} canPlaceAt={canPlaceAt} hoverCell={hoverCell3d} setHoverCell={setHoverCell3d} activeTool={activeTool} orientation={orientation} notchCorner={notchCorner} rebateDepthMm={rebateDepthMm} snapStep={snapStep} customBrick={customBrick} plateSpec={plateSpec} doorSpec={doorSpec} damperSpec={damperSpec} grateSpec={grateSpec} unit={unit} />
        </group>
      </Canvas>
    </div>
  );
}

// memo: hoverCell3d в ThreeStack меняется на каждое движение указателя и
// перерисовывает весь Canvas — статичные подложка/сетка/подписи не пересобираем.
const FoundationSlab = memo(function FoundationSlab({ grid }: { grid: GridSpec }) {
  return <mesh position={[0, -0.08, 0]} receiveShadow><boxGeometry args={[grid.cols + 0.4, 0.12, grid.rows + 0.4]} /><meshStandardMaterial color={COLORS.foundation} roughness={0.88} /></mesh>;
});

const ThreeGrid = memo(function ThreeGrid({ grid, gridY }: { grid: GridSpec; gridY: number }) {
  return (
    <group>
      {Array.from({ length: grid.cols + 1 }).map((_, x) => { const world = cellToWorld(x, 0, grid); return <mesh key={`grid-x-${x}`} position={[world.x, gridY, 0]}><boxGeometry args={[0.012, 0.012, grid.rows]} /><meshBasicMaterial color={COLORS.sageDark} transparent opacity={0.45} /></mesh>; })}
      {Array.from({ length: grid.rows + 1 }).map((_, z) => { const world = cellToWorld(0, z, grid); return <mesh key={`grid-z-${z}`} position={[0, gridY, world.z]}><boxGeometry args={[grid.cols, 0.012, 0.012]} /><meshBasicMaterial color={COLORS.sageDark} transparent opacity={0.45} /></mesh>; })}
    </group>
  );
});

const DimensionLabels = memo(function DimensionLabels({ grid, gridY, unit }: { grid: GridSpec; gridY: number; unit: string }) {
  return (
    <group>
      <Text position={[0, gridY + 0.04, grid.rows / 2 + 0.48]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.22} color={COLORS.charcoal} anchorX="center" anchorY="middle">{grid.widthCm} {unit}</Text>
      <Text position={[-grid.cols / 2 - 0.5, gridY + 0.04, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} fontSize={0.22} color={COLORS.charcoal} anchorX="center" anchorY="middle">{grid.lengthCm} {unit}</Text>
      {Array.from({ length: grid.cols + 1 }).map((_, x) => { const world = cellToWorld(x, grid.rows, grid); return <Text key={`x-label-${x}`} position={[world.x, gridY + 0.04, world.z + 0.18]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.14} color={COLORS.sageDark}>{Math.round((x * grid.widthCm) / grid.cols)}</Text>; })}
      {Array.from({ length: grid.rows + 1 }).map((_, z) => { const world = cellToWorld(0, z, grid); return <Text key={`z-label-${z}`} position={[-grid.cols / 2 - 0.22, gridY + 0.04, world.z]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} fontSize={0.14} color={COLORS.sageDark}>{Math.round((z * grid.lengthCm) / grid.rows)}</Text>; })}
    </group>
  );
});

function PlacementCells({
  grid,
  currentRow,
  rowBricks,
  placeAt,
  canPlaceAt,
  hoverCell,
  setHoverCell,
  activeTool,
  orientation,
  notchCorner,
  rebateDepthMm,
  snapStep,
  customBrick,
  plateSpec,
  doorSpec,
  damperSpec,
  grateSpec,
  unit
}: {
  grid: GridSpec;
  currentRow: number;
  rowBricks: PlacedBrick[];
  placeAt: (x: number, y: number, exactX?: number, exactY?: number) => void;
  canPlaceAt: (x: number, y: number) => boolean;
  hoverCell: HoverCell;
  setHoverCell: React.Dispatch<React.SetStateAction<HoverCell>>;
  activeTool: ToolKind;
  orientation: Orientation;
  notchCorner: NotchCorner;
  rebateDepthMm: number;
  snapStep: SnapStep;
  customBrick: CustomBrickSpec | null;
  plateSpec: CustomBrickSpec;
  doorSpec: CustomBrickSpec;
  damperSpec: CustomBrickSpec;
  grateSpec: CustomBrickSpec;
  unit: string;
}) {
  const gridY = (currentRow - 1) * BRICK_LAYER_HEIGHT + 0.02;
  const previewKind: BrickKind = activeTool === "eraser" ? "cut" : activeTool;
  const previewOrientation: Orientation = activeTool === "eraser" ? "h" : orientation;

  // Курсор ставим на body — обязателен сброс при размонтировании (уход в 2D/другой экран),
  // иначе «pointer» залипает на всём приложении.
  useEffect(() => () => { document.body.style.cursor = "auto"; }, []);

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
        const draft = { id: "hover", row: currentRow, x: hoverCell.x, y: hoverCell.y, kind: previewKind, orientation: previewOrientation, notchCorner: previewKind === "rebate" ? notchCorner : undefined, custom: previewKind === "custom" ? customBrick ?? undefined : previewKind === "plate" ? plateSpec : previewKind === "cleanout" ? doorSpec : previewKind === "damper" ? damperSpec : previewKind === "grate" ? grateSpec : previewKind === "rebate" ? { name: "", w: 2, h: 1, notch: null, notchDepthMm: rebateDepthMm } : undefined } as PlacedBrick;
        // честное превью посадки: колосник всегда заподлицо (авто-обвязка при
        // установке даёт опору), flush-плита — заподлицо при опоре, на низ
        // ряда без неё — ровно как настоящая установка
        if (draft.custom && previewKind === "grate") {
          draft.custom = { ...draft.custom, seatZMm: BRICK_MM - (draft.custom.thicknessMm ?? 22) };
        } else if (draft.custom && previewKind === "plate" && draft.custom.flush === true) {
          draft.custom = { ...draft.custom, seatZMm: plateSeatZ(rowBricks, draft) };
        }
        const geom = brickWorldGeometry(draft, grid);
        // честное превью: та же проверка, что и настоящая установка (3D-коллизии)
        const fits = activeTool === "eraser" ? true : isInsideGrid(draft, grid) && canPlaceAt(hoverCell.x, hoverCell.y);
        const color = activeTool === "eraser" ? "#c94f4f" : getToolColor(previewKind);

        return (
          <group>
            {previewKind === "grate"
              ? <ThreeGrate grid={grid} brick={draft} currentRow={currentRow} opacity={fits ? 0.42 : 0.22} unit={unit} />
              : previewKind === "rebate" || previewKind === "custom"
              ? <ThreeRebate grid={grid} brick={draft} currentRow={currentRow} opacity={fits ? 0.42 : 0.22} />
              : previewKind === "plate"
              ? <ThreePlate grid={grid} brick={draft} currentRow={currentRow} opacity={fits ? 0.42 : 0.22} />
              : previewKind === "damper"
              ? <ThreeDamper grid={grid} brick={draft} currentRow={currentRow} opacity={fits ? 0.42 : 0.22} />
              : previewKind === "cleanout"
              ? <ThreeDoor grid={grid} brick={draft} currentRow={currentRow} opacity={fits ? 0.42 : 0.22} />
              : (
                <mesh position={[geom.position[0], gridY + geom.scale[1] / 2, geom.position[2]]}>
                  <boxGeometry args={[geom.scale[0], Math.max(0.06, geom.scale[1] * 0.65), geom.scale[2]]} />
                  <meshStandardMaterial color={color} transparent opacity={fits ? 0.35 : 0.22} />
                </mesh>
              )}
            {!fits && activeTool !== "eraser" ? (
              <mesh position={[geom.position[0], gridY + geom.scale[1] / 2, geom.position[2]]}>
                <boxGeometry args={[geom.scale[0] + 0.06, Math.max(0.08, geom.scale[1] * 0.7), geom.scale[2] + 0.06]} />
                <meshBasicMaterial color="#9b2c2c" transparent opacity={0.3} depthWrite={false} />
              </mesh>
            ) : null}
            <Text position={[geom.position[0], gridY + Math.max(0.08, geom.scale[1] * 0.75), geom.position[2]]} fontSize={0.24} color={fits ? "#2f5d38" : "#9b2c2c"} outlineWidth={0.012} outlineColor="#FFF7E8" anchorX="center" anchorY="middle">{activeTool === "eraser" ? "−" : !fits ? "×" : previewOrientation === "h" ? "+ H" : "+ V"}</Text>
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
        onPointerOut={() => { setHoverCell(null); document.body.style.cursor = "auto"; }}
        onClick={(event) => {
          // Отпускание после drag-вращения OrbitControls тоже приходит как click:
          // накопленное смещение указателя > 2px — это было вращение, не установка.
          if (event.delta > 2) return;
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
