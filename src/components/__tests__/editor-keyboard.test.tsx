import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { BuilderScreen } from "../BuilderScreen";
import { initialEditorState } from "../../domain/editor/state";
import { estimateMaterials } from "../../domain/materials";

const effects = vi.hoisted(() => [] as (() => void | (() => void))[]);
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: (effect: () => void | (() => void)) => effects.push(effect)
}));
afterEach(() => {
  effects.length = 0;
  vi.unstubAllGlobals();
});

it("leaves IME and Alt-modified keys untouched while ordinary editor shortcuts still work", () => {
  const listeners = new Set<(event: KeyboardEvent) => void>();
  vi.stubGlobal("window", {
    addEventListener: (name: string, callback: (event: KeyboardEvent) => void) => {
      if (name === "keydown") listeners.add(callback);
    },
    removeEventListener: (_name: string, callback: (event: KeyboardEvent) => void) => listeners.delete(callback)
  });
  const no = () => {};
  const actions = { tool: vi.fn(), rotate: vi.fn(), undo: vi.fn(), redo: vi.fn(), save: vi.fn() };
  const state = initialEditorState();
  renderToStaticMarkup(
    <BuilderScreen
      {...state}
      t={(key) => key}
      userLogin=""
      sceneRevision={1}
      setCurrentRow={no}
      setActiveTool={actions.tool}
      setOrientation={actions.rotate}
      setNotchCorner={no}
      setRebateDepth={no}
      setSnapStep={no}
      pickCustomBrick={no}
      setPlateSize={no}
      setDoorSize={no}
      setDamperSize={no}
      setGrateSize={no}
      placeAt={no}
      previewAt={() => {
        throw new Error("No placement during SSR");
      }}
      addRow={no}
      deleteCurrentRow={no}
      copyPreviousRow={no}
      fillCurrentRow={no}
      clearCurrentRow={no}
      lockRow={no}
      unlockRow={no}
      canUndo={false}
      canRedo={false}
      undo={actions.undo}
      redo={actions.redo}
      materials={estimateMaterials(Object.values(state.rows).flat(), state.parameters)}
      saveCurrentProject={actions.save}
      setDamperOpenings={no}
    />
  );
  const cleanups = effects.map((effect) => effect());
  const press = (key: string, isComposing: boolean, ctrlKey = false, altKey = false, metaKey = false) => {
    const preventDefault = vi.fn();
    const event = {
      key,
      isComposing,
      ctrlKey,
      altKey,
      metaKey,
      preventDefault,
      target: null
    } as unknown as KeyboardEvent;
    for (const listener of listeners) listener(event);
    return preventDefault;
  };
  try {
    expect(listeners.size).toBe(1);
    for (const key of ["r", "b", "e"]) expect(press(key, true)).not.toHaveBeenCalled();
    for (const key of ["z", "y", "s"]) expect(press(key, true, true)).not.toHaveBeenCalled();
    // Ctrl+Alt (including AltGr) and Command+Option belong to native/input shortcuts.
    for (const key of ["r", "b", "e", "z", "y", "s"]) {
      expect(press(key, false, true, true)).not.toHaveBeenCalled();
      expect(press(key, false, false, true, true)).not.toHaveBeenCalled();
      expect(press(key, false, false, true)).not.toHaveBeenCalled();
    }
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled();
    press("r", false);
    press("b", false);
    press("e", false);
    press("z", false, true);
    press("y", false, true);
    press("s", false, true);
    expect(actions.rotate).toHaveBeenCalledOnce();
    expect(actions.tool.mock.calls).toEqual([["standard"], ["eraser"]]);
    expect(actions.undo).toHaveBeenCalledOnce();
    expect(actions.redo).toHaveBeenCalledOnce();
    expect(actions.save).toHaveBeenCalledOnce();
  } finally {
    for (const cleanup of cleanups) cleanup?.();
  }
  expect(listeners.size).toBe(0);
});
