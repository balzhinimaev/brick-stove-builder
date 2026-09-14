import { useCallback, useEffect, useRef, useState } from "react";
import type { GridSpec, PlacedBrick } from "../domain/types";
import type { PhysicsModel, PhysicsSettings } from "../domain/physics/model";
import type { PhysicsCommand, PhysicsResponse } from "../domain/physics/protocol";
import type { PhysicsFrame } from "../domain/physics/simulation";

export function usePhysics(bricks: PlacedBrick[], grid: GridSpec, settings: PhysicsSettings) {
  const worker = useRef<Worker | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [state, setState] = useState<{
    bricks: PlacedBrick[];
    grid: GridSpec;
    settings: PhysicsSettings;
    model: PhysicsModel | null;
    frame: PhysicsFrame | null;
    running: boolean;
    status: string;
    error: string;
  } | null>(null);
  useEffect(() => {
    let live = true;
    setElapsedMs(0);
    const initial = {
      bricks,
      grid,
      settings,
      model: null,
      frame: null,
      running: false,
      status: "Подготовка проверки…",
      error: ""
    };
    setState(initial);
    let instance: Worker;
    try {
      instance = new Worker(new URL("../workers/physics.worker.ts", import.meta.url), { type: "module" });
    } catch {
      setState({ ...initial, status: "", error: "Не удалось открыть расчёт. Попробуйте обновить страницу." });
      return;
    }
    worker.current = instance;
    instance.onmessage = (event: MessageEvent<PhysicsResponse>) => {
      if (!live) return;
      const response = event.data;
      setState((previous) => {
        const value = previous ?? initial;
        if (response.type === "model")
          return { ...value, model: response.model, frame: null, running: false, status: "", error: "" };
        if (response.type === "frame")
          return { ...value, frame: response.frame, running: response.running, status: "", error: "" };
        if (response.type === "error") return { ...value, running: false, status: "", error: response.message };
        return { ...value, status: response.text };
      });
    };
    instance.onerror = () => {
      if (live)
        setState((s) => ({
          ...(s ?? initial),
          running: false,
          status: "",
          error: "Расчёт прерван. Закройте и снова откройте панель."
        }));
    };
    instance.postMessage({ type: "build", bricks, grid, settings } satisfies PhysicsCommand);
    const pauseHidden = () => {
      if (document.hidden) instance.postMessage({ type: "pause" } satisfies PhysicsCommand);
    };
    document.addEventListener("visibilitychange", pauseHidden);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", pauseHidden);
      instance.terminate();
      if (worker.current === instance) worker.current = null;
    };
  }, [bricks, grid, settings]);
  // A document edit invalidates results synchronously, before effect cleanup.
  const current = state?.bricks === bricks && state.grid === grid && state.settings === settings ? state : null;
  const send = useCallback(
    (type: Exclude<PhysicsCommand["type"], "build">) => {
      if (current?.model && worker.current) worker.current.postMessage({ type } satisfies PhysicsCommand);
    },
    [current?.model]
  );
  const calculating = current?.running || !!current?.status;
  useEffect(() => {
    if (!calculating) return;
    let previous = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      setElapsedMs((v) => v + now - previous);
      previous = now;
    }, 500);
    return () => clearInterval(timer);
  }, [calculating]);
  return {
    elapsedMs,
    model: current?.model ?? null,
    frame: current?.frame ?? null,
    running: current?.running ?? false,
    status: current?.status ?? "Подготовка проверки…",
    error: current?.error ?? "",
    send
  };
}
