import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { BuilderScreen, type BuilderScreenProps } from "../BuilderScreen";
import { ExactSection } from "../ExactSection";
import { PartInspector } from "../PartInspector";
import { Toolbox } from "../builder/Toolbox";
import { initialEditorState } from "../../domain/editor/state";
import { estimateMaterials } from "../../domain/materials";
import type { LocalWorkspace } from "../../hooks/useLocalWorkspace";

const hooks = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
  effects: [] as (() => void | (() => void))[]
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = typeof initial === "function" ? initial() : initial;
    return [
      hooks.values[index],
      (value: unknown) => {
        hooks.values[index] = typeof value === "function" ? value(hooks.values[index]) : value;
      }
    ];
  },
  useRef: (current: unknown) => ({ current }),
  useId: () => "inspector-test",
  useMemo: (factory: () => unknown) => factory(),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void)) => hooks.effects.push(effect)
}));
vi.mock("../../hooks/useCustomBricks", () => ({
  useCustomBricks: () => ({ customBricks: [], addCustomBrick: vi.fn(), removeCustomBrick: vi.fn() })
}));
afterEach(() => {
  hooks.values = [];
  hooks.cursor = 0;
  hooks.effects = [];
  vi.unstubAllGlobals();
});

type NodeProps = {
  children?: ReactNode;
  className?: string;
  inert?: boolean;
  onClick?: () => void;
};
function nodes(node: ReactNode): ReactElement<NodeProps>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<NodeProps>(node)) return [];
  return [node, ...nodes(node.props.children)];
}

function setup() {
  const state = initialEditorState();
  const no = vi.fn();
  const props: BuilderScreenProps = {
    ...state,
    t: (key) => key,
    userLogin: "",
    sceneRevision: 1,
    setCurrentRow: vi.fn(),
    setActiveTool: vi.fn(),
    setOrientation: vi.fn(),
    setNotchCorner: no,
    setRebateDepth: no,
    setSnapStep: no,
    pickCustomBrick: no,
    setPlateSize: no,
    setDoorSize: no,
    setDamperSize: no,
    setGrateSize: no,
    placeAt: no,
    previewAt: () => {
      throw new Error("No placement in controller test");
    },
    addRow: no,
    deleteCurrentRow: no,
    copyPreviousRow: no,
    fillCurrentRow: no,
    clearCurrentRow: no,
    lockRow: no,
    unlockRow: no,
    canUndo: true,
    canRedo: true,
    undo: vi.fn(),
    redo: vi.fn(),
    saveCurrentProject: vi.fn(),
    setDamperOpenings: no,
    editPart: vi.fn(),
    removePart: no,
    onExitSection: vi.fn(),
    materials: estimateMaterials([], state.parameters)
  };
  const listeners = new Set<(event: KeyboardEvent) => void>();
  let cleanups: (void | (() => void))[] = [];
  let tree: ReactNode;
  vi.stubGlobal("document", { querySelector: () => null });
  vi.stubGlobal("window", {
    addEventListener: (name: string, callback: (event: KeyboardEvent) => void) => {
      if (name === "keydown") listeners.add(callback);
    },
    removeEventListener: (_name: string, callback: (event: KeyboardEvent) => void) => listeners.delete(callback)
  });
  const render = () => {
    for (const cleanup of cleanups) cleanup?.();
    hooks.cursor = 0;
    hooks.effects = [];
    tree = BuilderScreen(props);
    cleanups = hooks.effects.map((effect) => effect());
  };
  const click = (label: string) => {
    const button = nodes(tree).find((node) => node.type === "button" && node.props.children === label);
    expect(button, label).toBeDefined();
    button?.props.onClick?.();
    render();
  };
  const press = (key: string, extra: Partial<KeyboardEvent> = {}) => {
    const event = { key, preventDefault: vi.fn(), target: null, ...extra } as unknown as KeyboardEvent;
    for (const listener of listeners) listener(event);
    render();
    return event;
  };
  render();
  return { props, render, click, press, nodes: () => nodes(tree) };
}

it("starts real placement from 2D, reveals tools and supports Russian tool keys", () => {
  const app = setup();
  app.click("Точное сечение · 2D");
  app.click("Скрыть панель");
  expect(app.nodes().some((node) => node.type === ExactSection)).toBe(true);
  app.press("и", { code: "KeyB" });
  expect(app.props.setActiveTool).toHaveBeenLastCalledWith("standard");
  expect(app.props.onExitSection).toHaveBeenCalledOnce();
  expect(app.nodes().some((node) => node.type === ExactSection)).toBe(false);
  expect(app.nodes().some((node) => node.type === Toolbox)).toBe(true);
  expect(app.nodes().find((node) => node.type === "aside")?.props.className).toContain("is-expanded");
  expect(app.nodes().some((node) => node.props.className?.includes("inspector-hidden"))).toBe(false);
  app.press("у");
  expect(app.props.setActiveTool).toHaveBeenLastCalledWith("eraser");
  app.press("к");
  expect(app.props.setOrientation).toHaveBeenCalledOnce();
  app.press("я", { ctrlKey: true });
  app.press("я", { metaKey: true, shiftKey: true });
  expect(app.props.undo).toHaveBeenCalledOnce();
  expect(app.props.redo).toHaveBeenCalledOnce();
});

it("opens the same part inspector from a 2D section and clears selection with Escape", () => {
  const app = setup();
  app.props.rows = { 1: [{ id: "test-brick", kind: "standard", row: 1, x: 0, y: 0, orientation: "h" }] };
  app.render();
  app.click("Точное сечение · 2D");
  app.click("Скрыть панель");
  const section = app.nodes().find((node) => node.type === ExactSection) as ReactElement<
    Parameters<typeof ExactSection>[0]
  >;
  section.props.onSelect?.(["test-brick"], 1);
  app.render();
  const inspector = app.nodes().find((node) => node.type === PartInspector) as ReactElement<
    Parameters<typeof PartInspector>[0]
  >;
  expect(inspector.props.brick.id).toBe("test-brick");
  expect(app.nodes().some((node) => node.props.className?.includes("inspector-hidden"))).toBe(false);
  inspector.props.onIsolate();
  app.render();
  app.press("Escape");
  expect(app.nodes().some((node) => node.type === PartInspector)).toBe(false);
  expect(app.nodes().some((node) => node.props.children === "Снять изоляцию")).toBe(false);
  expect(app.props.editPart).not.toHaveBeenCalled();
});

it("leaves typing, modifier combinations and repeated tool keys alone", () => {
  const app = setup();
  for (const extra of [
    { isComposing: true },
    { altKey: true },
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { repeat: true },
    { defaultPrevented: true },
    { target: { closest: () => ({}) } as unknown as EventTarget },
    { target: { isContentEditable: true } as unknown as EventTarget }
  ]) {
    app.press("и", extra);
  }
  expect(app.props.setActiveTool).not.toHaveBeenCalled();
  expect(app.props.onExitSection).not.toHaveBeenCalled();
});

it("blocks edits and shortcuts while another project is being opened", () => {
  const app = setup();
  app.props.workspace = { ready: true, busy: true, state: "saving" } as LocalWorkspace;
  app.render();
  app.press("b");
  app.press("r");
  app.press("z", { ctrlKey: true });
  app.press("s", { ctrlKey: true });
  app.press("PageDown");
  for (const action of [
    app.props.setActiveTool,
    app.props.setOrientation,
    app.props.undo,
    app.props.saveCurrentProject,
    app.props.setCurrentRow
  ]) {
    expect(action).not.toHaveBeenCalled();
  }
  expect(app.nodes().find((node) => node.props.className === "assembly-editor-content")?.props.inert).toBe(true);
});
