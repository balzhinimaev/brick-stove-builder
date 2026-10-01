import { Canvas } from "@react-three/fiber";
import { useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import { Vector3 } from "three";
import type { GridSpec, PlacedBrick } from "../domain/types";
import { AssemblyPlayback, assemblyFrame, bindPlaybackVisibility } from "./builder/assemblyPlayback";
import { archSceneBounds } from "./three/ClassicArchOverlay";
import { type CameraCommand, SceneCamera } from "./three/SceneCamera";
import { BrickHighlight, isMasonry, Masonry, ThreeBrick } from "./three/ThreeBrick";
import { Foundation } from "./three/ThreeStack";

export default function AssemblyMovie({
  bricks,
  grid,
  rowCount,
  foundationHeight,
  onClose,
  returnFocus
}: {
  bricks: PlacedBrick[];
  grid: GridSpec;
  rowCount: number;
  foundationHeight: number;
  onClose: () => void;
  returnFocus: HTMLElement | null;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const total = bricks.length ? Math.max(rowCount, ...bricks.map((b) => b.row)) : 0;
  const player = useMemo(() => new AssemblyPlayback(total, refresh), [total]);
  const [command, setCommand] = useState<CameraCommand>({ id: 0, kind: "iso" });
  useEffect(() => bindPlaybackVisibility(player, document), [player]);
  useEffect(() => {
    const element = dialog.current;
    const previous = returnFocus ?? document.activeElement;
    element?.showModal();
    return () => {
      player.dispose();
      element?.close();
      queueMicrotask(() => {
        if (!element?.open && previous instanceof HTMLElement && previous.isConnected) previous.focus();
      });
    };
  }, [player, returnFocus]);
  const bounds = useMemo(() => {
    const box = archSceneBounds(bricks, grid);
    box.expandByPoint(new Vector3(-grid.cols / 2 - 0.25, -foundationHeight, -grid.rows / 2 - 0.25));
    box.expandByPoint(new Vector3(grid.cols / 2 + 0.25, 0, grid.rows / 2 + 0.25));
    return { size: box.getSize(new Vector3()), center: box.getCenter(new Vector3()) };
  }, [bricks, grid, foundationHeight]);
  const frame = useMemo(() => assemblyFrame(bricks, player.row), [bricks, player.row]);
  return (
    <dialog
      ref={dialog}
      className="assembly-movie"
      aria-labelledby={titleId}
      onCancel={onClose}
      onClose={() => {
        if (!dialog.current?.open) onClose();
      }}
    >
      <header>
        <div>
          <h2 id={titleId}>Кино сборки</h2>
          <p>Вся печь по рядам · только просмотр</p>
        </div>
        <button type="button" onClick={onClose}>
          Закрыть
        </button>
      </header>
      {total ? (
        <>
          <div className="assembly-movie-scene">
            <Canvas
              frameloop="demand"
              dpr={[1, 1.5]}
              camera={{ position: [16, 14, 16], fov: 38, near: 0.05, far: 1000 }}
            >
              <color attach="background" args={["#e8e9e5"]} />
              <ambientLight intensity={0.65} />
              <hemisphereLight args={["#fffaf0", "#666b65", 1.2]} />
              <directionalLight position={[10, 30, 15]} intensity={2.6} />
              <SceneCamera
                width={bounds.size.x}
                depth={bounds.size.z}
                height={bounds.size.y}
                centerX={bounds.center.x}
                centerY={bounds.center.y}
                centerZ={bounds.center.z}
                inspect
                command={command}
              />
              <Foundation grid={grid} thickness={foundationHeight} sectionActive={false} />
              <Masonry bricks={frame.visible.filter(isMasonry)} grid={grid} />
              {frame.visible
                .filter((b) => !isMasonry(b))
                .map((b) => (
                  <ThreeBrick key={b.id} brick={b} grid={grid} />
                ))}
              {frame.fresh.map((b) => (
                <BrickHighlight key={b.id} brick={b} grid={grid} color="#d8bd78" />
              ))}
            </Canvas>
          </div>
          <div className="assembly-movie-controls">
            <button type="button" onClick={() => player.seek(0)}>
              В начало
            </button>
            <button type="button" onClick={() => (player.playing ? player.pause() : !document.hidden && player.play())}>
              {player.playing ? "Пауза" : "▶ Воспроизвести"}
            </button>
            <button type="button" onClick={() => player.seek(total)}>
              В конец
            </button>
            <label>
              Скорость{" "}
              <select value={player.speed} onChange={(e) => player.setSpeed(Number(e.target.value))}>
                <option value={0.5}>0.5×</option>
                <option value={1}>1×</option>
                <option value={2}>2×</option>
              </select>
            </label>
            <button type="button" onClick={() => setCommand((c) => ({ id: c.id + 1, kind: "fit" }))}>
              Вся печь в кадре
            </button>
          </div>
          <label className="assembly-movie-scrub">
            Ряд {player.row} / {total}
            <input
              aria-label="Ряд сборки"
              type="range"
              min={0}
              max={total}
              value={player.row}
              onChange={(e) => player.seek(Number(e.target.value))}
            />
          </label>
          <p>
            Детали: {frame.visible.length} / {bricks.length} · В новом ряду: {frame.fresh.length}
            {player.row === 0
              ? " · Фундамент — нажмите «Воспроизвести»"
              : player.row === total
                ? " · Сборка завершена"
                : ""}
          </p>
        </>
      ) : (
        <p>В печи пока нет деталей. Добавьте их в редакторе, чтобы посмотреть сборку.</p>
      )}
    </dialog>
  );
}
