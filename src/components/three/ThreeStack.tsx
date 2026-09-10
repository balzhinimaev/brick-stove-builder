import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { Plane, Vector3 } from "three";
import type { Translate } from "../../i18n";
import type { GridSpec, PlacedBrick, SnapStep } from "../../domain/types";
import { BRICK_LAYER_HEIGHT, MM_PER_CELL } from "../../domain/constants";
import { canConfirmPlacement, type PlacementPoint, type PlacementPreview } from "../../domain/editor/preview";
import { BrickHighlight, isMasonry, Masonry, ThreeBrick } from "./ThreeBrick";
import { SceneCamera, type CameraCommand } from "./SceneCamera";
import { inspectionPlane, sectionScene } from "./sectionGeometry";
import type { TeplushkaInspection } from "../builder/teplushkaInspection";
import {
  nudgePoint,
  placementPoint,
  PlacementGesture,
  setPointCoordinateMm,
  solidBoxes,
  withPlacementAdjustments
} from "./sceneMath";

export type ThreeStackProps = {
  grid: GridSpec;
  foundationHeight: number;
  bricks: PlacedBrick[];
  currentRow: number;
  locked: boolean;
  snapStep: SnapStep;
  t: Translate;
  previewAt: (point: PlacementPoint) => PlacementPreview;
  placeAt: (x: number, y: number, exactX?: number, exactY?: number) => void;
  rotateBrick: () => void;
  inspection?: TeplushkaInspection;
  onExitSection?: () => void;
};

export function ThreeStack({
  grid,
  foundationHeight,
  bricks,
  currentRow,
  locked,
  snapStep,
  t,
  previewAt,
  placeAt,
  rotateBrick,
  inspection,
  onExitSection
}: ThreeStackProps) {
  const [inspect, setInspect] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [point, setPoint] = useState<PlacementPoint | null>(null);
  const [command, setCommand] = useState<CameraCommand>({ id: 0, kind: "iso" });
  const gesture = useRef(new PlacementGesture());
  const tap = useRef(false);
  const viewport = useRef<HTMLDivElement>(null);
  const sectionActive = !!inspection && inspection.section !== "whole";
  const selectionContext = useRef({ currentRow, grid, inspect });
  const visible = useMemo(
    () => bricks.filter((brick) => inspect || brick.row <= currentRow),
    [bricks, inspect, currentRow]
  );
  const height = useMemo(
    () =>
      Math.max(
        BRICK_LAYER_HEIGHT * currentRow,
        ...visible.flatMap((brick) => solidBoxes(brick, grid).map((box) => box.position[1] + box.scale[1] / 2))
      ),
    [visible, grid, currentRow]
  );
  const preview = useMemo(() => (point ? previewAt(point) : null), [point, previewAt]);
  const valid = !!preview && canConfirmPlacement(preview) && !locked && !inspect;
  const sceneBricks = useMemo(
    () => withPlacementAdjustments(visible, valid ? preview : null),
    [visible, preview, valid]
  );
  const clipPlane = useMemo(() => inspectionPlane(inspection, bricks, grid), [inspection, bricks, grid]);
  const section = useMemo(
    () => (clipPlane ? sectionScene(sceneBricks, grid, clipPlane, foundationHeight) : null),
    [sceneBricks, grid, clipPlane, foundationHeight]
  );
  useEffect(() => () => section?.geometry.dispose(), [section]);
  // Omit fully removed draws as well as their caps. GPU clipping is still needed
  // for intersected bricks, but must not leave raster fragments of a removed chimney.
  const renderedBricks = useMemo(
    () => (section ? sceneBricks.filter((brick) => section.retainedBrickIds.has(brick.id)) : sceneBricks),
    [sceneBricks, section]
  );
  const sectionSize = section?.bounds.getSize(new Vector3());
  const sectionCenter = section?.bounds.getCenter(new Vector3());
  const act = (kind: CameraCommand["kind"]) => setCommand((previous) => ({ id: previous.id + 1, kind }));
  const inspectionSection = inspection?.section;
  const inspectionCourseOnly = inspection?.courseOnly;
  useEffect(() => {
    setInspect(inspectionSection !== undefined && !inspectionCourseOnly);
    setPoint(null);
    gesture.current.cancel();
    tap.current = false;
    setCommand((previous) => ({ id: previous.id + 1, kind: "iso" }));
  }, [inspectionSection, inspectionCourseOnly]);
  const confirm = () => {
    if (!point || !valid) return;
    placeAt(point.x, point.y, point.rawX, point.rawY);
    setPoint(null);
  };
  useEffect(() => {
    const previous = selectionContext.current;
    if (previous.currentRow !== currentRow || previous.grid !== grid || previous.inspect !== inspect) {
      setPoint(null);
      gesture.current.cancel();
      tap.current = false;
    }
    selectionContext.current = { currentRow, grid, inspect };
  }, [currentRow, grid, inspect]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || target?.closest("input,textarea,select,button,dialog,[role=dialog]")) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Escape") setPoint(null);
      if (event.key === "Enter" && point) {
        event.preventDefault();
        confirm();
      }
      const offset: Record<string, [number, number]> = {
        ArrowLeft: [-snapStep, 0],
        ArrowRight: [snapStep, 0],
        ArrowUp: [0, -snapStep],
        ArrowDown: [0, snapStep]
      };
      if (point && offset[event.key]) {
        event.preventDefault();
        const [x, y] = offset[event.key];
        setPoint(nudgePoint(point, x, y));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const select = (event: ThreeEvent<PointerEvent>) => {
    if (!tap.current || inspect || locked || event.button !== 0) return;
    event.stopPropagation();
    const hit = event.ray.intersectPlane(
      new Plane(new Vector3(0, 1, 0), -(currentRow - 1) * BRICK_LAYER_HEIGHT),
      new Vector3()
    );
    if (hit) setPoint(placementPoint(hit.x, hit.z, grid, snapStep));
  };
  const statusKey =
    preview?.status === "unsupported"
      ? "placementUnsupported"
      : preview?.status === "blocked"
        ? "placementBlocked"
        : preview?.status === "outside"
          ? "placementOutside"
          : preview?.status === "empty"
            ? "placementEmpty"
            : preview?.status === "locked" || locked
              ? "placementLocked"
              : preview?.status === "erase"
                ? "placementErase"
                : preview?.status === "toggle"
                  ? "placementToggle"
                  : "placementReady";
  return (
    <div className="scene-workspace">
      <div className="scene-toolbar">
        <fieldset className="studio-segment" aria-label={t("interactionMode")}>
          <button
            type="button"
            aria-pressed={!inspect}
            onClick={() => {
              onExitSection?.();
              setInspect(false);
            }}
          >
            {t("buildMode")}
          </button>
          <button type="button" aria-pressed={inspect} onClick={() => setInspect(true)}>
            {t("inspectMode")}
          </button>
        </fieldset>
        <fieldset className="scene-camera" aria-label={t("camera")}>
          {(
            [
              ["iso", "cameraIso"],
              ["front", "cameraFront"],
              ["top", "cameraTop"],
              ["fit", "cameraFit"]
            ] as const
          ).map(([kind, label]) => (
            <button key={kind} type="button" onClick={() => act(kind)}>
              {t(label)}
            </button>
          ))}
        </fieldset>
        <button type="button" aria-pressed={showGrid} onClick={() => setShowGrid(!showGrid)}>
          {t("gridLabel")}
        </button>
      </div>
      <div
        ref={viewport}
        role="application"
        aria-label={t("aria3d")}
        tabIndex={-1}
        className={`scene-canvas ${inspect ? "is-inspecting" : "is-building"}`}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDownCapture={(event) => {
          if (event.target instanceof HTMLCanvasElement) {
            viewport.current?.focus({ preventScroll: true });
            gesture.current.down(event.pointerId, event.clientX, event.clientY);
            tap.current = false;
          }
        }}
        onPointerMoveCapture={(event) => gesture.current.move(event.clientX, event.clientY)}
        onPointerUpCapture={(event) => {
          tap.current = gesture.current.up(event.pointerId, event.clientX, event.clientY);
        }}
        onPointerCancelCapture={() => {
          gesture.current.cancel();
          tap.current = false;
        }}
        onPointerLeave={() => {
          gesture.current.cancel();
          tap.current = false;
        }}
      >
        <div className="scene-badge">
          {sectionActive ? t("sectionView") : inspect ? t("wholeModel") : `${t("currentRow")} ${currentRow}`}{" "}
          <span>
            · {grid.widthCm} × {grid.lengthCm} {t("unitCm")}
          </span>
        </div>
        <Canvas
          frameloop="demand"
          shadows={!sectionActive}
          dpr={[1, 1.5]}
          camera={{ position: [16, 14, 16], fov: 38, near: 0.05, far: 1000 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          aria-label={t("aria3d")}
        >
          <color attach="background" args={["#e8e9e5"]} />
          <SectionClipping plane={clipPlane} />
          <ambientLight intensity={0.45} />
          <hemisphereLight args={["#fffaf0", "#666b65", 1.2]} />
          <directionalLight
            position={[grid.cols * 0.5, height + 14, grid.rows * 0.7]}
            intensity={2.6}
            castShadow={!sectionActive}
            shadow-mapSize={[1024, 1024]}
            shadow-normalBias={0.015}
            shadow-bias={-0.0001}
            shadow-camera-left={-Math.max(grid.cols, grid.rows)}
            shadow-camera-right={Math.max(grid.cols, grid.rows)}
            shadow-camera-top={height + Math.max(grid.cols, grid.rows)}
            shadow-camera-bottom={-Math.max(grid.cols, grid.rows)}
            shadow-camera-far={height + 100}
          />
          <directionalLight position={[-10, 6, -8]} intensity={0.65} />
          <SceneCamera
            width={sectionSize?.x ?? grid.cols + 1}
            depth={sectionSize?.z ?? grid.rows + 1}
            height={sectionSize?.y ?? height + foundationHeight}
            centerX={sectionCenter?.x ?? 0}
            centerY={sectionCenter?.y ?? (height - foundationHeight) / 2}
            centerZ={sectionCenter?.z ?? 0}
            inspect={inspect}
            frontSign={inspection ? -1 : 1}
            command={command}
          />
          <Foundation grid={grid} thickness={foundationHeight} sectionActive={sectionActive} />
          {section && (
            <mesh geometry={section.geometry}>
              <meshStandardMaterial vertexColors roughness={0.94} />
            </mesh>
          )}
          <Masonry bricks={renderedBricks} grid={grid} />
          {renderedBricks
            .filter((brick) => !isMasonry(brick))
            .map((brick) => (
              <ThreeBrick key={brick.id} grid={grid} brick={brick} />
            ))}
          {showGrid && !inspect && (
            <WorkGrid grid={grid} elevation={(currentRow - 1) * BRICK_LAYER_HEIGHT + 0.006} step={snapStep} />
          )}
          {!inspect &&
            visible
              .filter((brick) => brick.kind === "vent" && brick.row === currentRow)
              .map((brick) => <BrickHighlight key={brick.id} brick={brick} grid={grid} color="#558fa4" />)}
          {!inspect &&
            preview?.bricks.map((brick) => (
              <BrickHighlight key={brick.id} brick={brick} grid={grid} color={valid ? "#25866d" : "#ba4a3d"} />
            ))}
          {!inspect &&
            preview?.adjustments.map((brick) => (
              <BrickHighlight key={brick.id} brick={brick} grid={grid} color="#ae863d" />
            ))}
          {!inspect &&
            preview?.affected.map((brick) => (
              <BrickHighlight
                key={brick.id}
                brick={brick}
                grid={grid}
                color={preview.status === "toggle" ? "#25866d" : "#ba4a3d"}
              />
            ))}
          <mesh
            position={[0, (currentRow - 1) * BRICK_LAYER_HEIGHT, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            onPointerUp={select}
          >
            <planeGeometry args={[grid.cols, grid.rows]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </Canvas>
        <fieldset className="scene-zoom" aria-label={t("camera")}>
          <button type="button" aria-label={t("cameraZoomIn")} onClick={() => act("in")}>
            +
          </button>
          <button type="button" aria-label={t("cameraZoomOut")} onClick={() => act("out")}>
            −
          </button>
          <button type="button" aria-label={t("cameraTurnLeft")} onClick={() => act("left")}>
            ↶
          </button>
          <button type="button" aria-label={t("cameraTurnRight")} onClick={() => act("right")}>
            ↷
          </button>
        </fieldset>
      </div>
      <div className="placement-panel">
        <output className="scene-instruction" aria-live="polite">
          {inspect
            ? t("inspectHint")
            : locked
              ? t("placementLocked")
              : point
                ? `${t(statusKey)}${preview?.adjustments.length ? ` ${t("autoSeatHint")}` : ""}`
                : t("placeHint")}
        </output>
        {!inspect && !locked && (
          <div className="placement-controls">
            <div className="placement-position">
              <button
                type="button"
                onClick={() => {
                  setPoint({ x: 0, y: 0, rawX: 0.01, rawY: 0.01 });
                  viewport.current?.focus({ preventScroll: true });
                }}
              >
                {t("setPosition")}
              </button>
              {point && (
                <>
                  {(["x", "y"] as const).map((axis) => (
                    <label className="position-coordinate" key={axis}>
                      {axis === "x" ? "X" : "Z"}, {t("unitMm")}
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        value={Number((point[axis] * MM_PER_CELL).toFixed(1))}
                        onChange={(event) =>
                          setPoint(setPointCoordinateMm(point, axis, event.currentTarget.valueAsNumber))
                        }
                      />
                    </label>
                  ))}
                  {(
                    [
                      [-1, 0, "X−"],
                      [1, 0, "X+"],
                      [0, -1, "Z−"],
                      [0, 1, "Z+"]
                    ] as const
                  ).map(([x, y, label]) => (
                    <button
                      key={label}
                      type="button"
                      aria-label={`${t("moveBrick")} ${label}`}
                      onClick={() => setPoint(nudgePoint(point, x * snapStep, y * snapStep))}
                    >
                      {label}
                    </button>
                  ))}
                </>
              )}
            </div>
            <div className="placement-confirm">
              <button type="button" onClick={rotateBrick}>
                {t("rotateBrick")}
              </button>
              {point && (
                <button type="button" onClick={() => setPoint(null)}>
                  {t("cancelPlacement")}
                </button>
              )}
              <button type="button" className="studio-primary" disabled={!valid} onClick={confirm}>
                {preview?.status === "erase"
                  ? t("removeElement")
                  : preview?.status === "toggle"
                    ? t("toggleElement")
                    : t("placeElement")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** A real rendering plane, including wedge faces. The editor document is never filtered or changed. */
function SectionClipping({ plane }: { plane: Plane | null }) {
  const { gl, invalidate } = useThree();
  const planes = useMemo(() => (plane ? [plane] : []), [plane]);
  useEffect(() => {
    const previous = gl.clippingPlanes;
    gl.clippingPlanes = planes;
    invalidate();
    return () => {
      gl.clippingPlanes = previous;
      invalidate();
    };
  }, [gl, planes, invalidate]);
  return null;
}

const Foundation = memo(function Foundation({
  grid,
  thickness,
  sectionActive
}: {
  grid: GridSpec;
  thickness: number;
  sectionActive: boolean;
}) {
  return (
    <group>
      <mesh position={[0, -thickness / 2, 0]} receiveShadow>
        <boxGeometry args={[grid.cols + 0.25, thickness, grid.rows + 0.25]} />
        <meshStandardMaterial color="#bcbeb5" roughness={0.96} />
      </mesh>
      {!sectionActive && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -thickness - 0.01, 0]} receiveShadow>
          <planeGeometry args={[250, 250]} />
          <meshStandardMaterial color="#dfe1db" roughness={1} />
        </mesh>
      )}
    </group>
  );
});

const WorkGrid = memo(function WorkGrid({
  grid,
  elevation,
  step
}: {
  grid: GridSpec;
  elevation: number;
  step: number;
}) {
  const points = useMemo(() => {
    const values: number[] = [];
    for (let x = 0; x <= grid.cols; x += step)
      values.push(x - grid.cols / 2, elevation, -grid.rows / 2, x - grid.cols / 2, elevation, grid.rows / 2);
    for (let z = 0; z <= grid.rows; z += step)
      values.push(-grid.cols / 2, elevation, z - grid.rows / 2, grid.cols / 2, elevation, z - grid.rows / 2);
    return new Float32Array(values);
  }, [grid, elevation, step]);
  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#688b85" transparent opacity={0.35} depthWrite={false} />
    </lineSegments>
  );
});
