import { afterEach, expect, it, vi } from "vitest";
import { ThreeStack } from "../ThreeStack";

const hooks = vi.hoisted(() => ({
  effects: [] as (() => void | (() => void))[],
  stateIndex: 0,
  setPoint: vi.fn()
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: (effect: () => void | (() => void)) => hooks.effects.push(effect),
  useMemo: (factory: () => unknown) => factory(),
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) =>
    hooks.stateIndex++ === 5 ? [{ x: 2, y: 3, rawX: 2, rawY: 3 }, hooks.setPoint] : [initial, vi.fn()]
}));
afterEach(() => {
  hooks.effects.length = 0;
  hooks.stateIndex = 0;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it.each(
  ["Enter", "Escape", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].flatMap((key) => [
    { key, selectParts: false, interactionDisabled: false },
    { key, selectParts: true, interactionDisabled: false },
    { key, selectParts: false, interactionDisabled: true }
  ])
)(
  "handles $key only in placement mode (selectParts=$selectParts, busy=$interactionDisabled), never during IME input",
  ({ key, selectParts, interactionDisabled }) => {
    const listeners = new Set<(event: KeyboardEvent) => void>();
    vi.stubGlobal("window", {
      addEventListener: (name: string, callback: (event: KeyboardEvent) => void) => {
        if (name === "keydown") listeners.add(callback);
      },
      removeEventListener: (_name: string, callback: (event: KeyboardEvent) => void) => listeners.delete(callback)
    });
    const placeAt = vi.fn();
    ThreeStack({
      grid: { cols: 8, rows: 8, widthCm: 100, lengthCm: 100 },
      foundationHeight: 1,
      bricks: [],
      currentRow: 1,
      locked: false,
      selectParts,
      interactionDisabled,
      snapStep: 0.5,
      t: (key) => key,
      previewAt: () => ({ status: "ready", bricks: [], affected: [], adjustments: [] }),
      placeAt,
      rotateBrick: vi.fn()
    });
    const cleanups = hooks.effects.map((effect) => effect());
    hooks.setPoint.mockClear();
    const preventDefault = vi.fn();
    const press = (isComposing: boolean) => {
      const event = { key, isComposing, target: null, preventDefault } as unknown as KeyboardEvent;
      for (const listener of listeners) listener(event);
    };
    try {
      expect(listeners.size).toBe(1);
      press(true);
      expect(placeAt).not.toHaveBeenCalled();
      expect(hooks.setPoint).not.toHaveBeenCalled();
      expect(preventDefault).not.toHaveBeenCalled();
      press(false);
      expect(hooks.setPoint).toHaveBeenCalledTimes(selectParts || interactionDisabled ? 0 : 1);
      if (key === "Enter" && !selectParts && !interactionDisabled)
        expect(placeAt).toHaveBeenCalledExactlyOnceWith(2, 3, 2, 3);
      else expect(placeAt).not.toHaveBeenCalled();
      expect(preventDefault).toHaveBeenCalledTimes(selectParts || interactionDisabled || key === "Escape" ? 0 : 1);
    } finally {
      for (const cleanup of cleanups) cleanup?.();
    }
    expect(listeners.size).toBe(0);
  }
);
