import { beforeEach, expect, it, vi } from "vitest";
import type { DraftSnapshot } from "../../domain/editor";

// Hook harness: exercise studio/editor actions without a DOM, WebGL or browser.
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, accept: (_draft: DraftSnapshot) => false }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const slot = hooks.cursor++;
    if (!(slot in hooks.slots)) hooks.slots[slot] = typeof initial === "function" ? initial() : initial;
    return [
      hooks.slots[slot],
      (value: unknown) => {
        hooks.slots[slot] = typeof value === "function" ? value(hooks.slots[slot]) : value;
      }
    ];
  },
  useReducer: (
    reduce: (state: unknown, action: unknown) => unknown,
    initial: unknown,
    init: (arg: unknown) => unknown
  ) => {
    const slot = hooks.cursor++;
    if (!(slot in hooks.slots)) hooks.slots[slot] = init ? init(initial) : initial;
    return [
      hooks.slots[slot],
      (action: unknown) => {
        hooks.slots[slot] = reduce(hooks.slots[slot], action);
      }
    ];
  },
  useMemo: (compute: () => unknown) => compute(),
  useCallback: (callback: unknown) => callback,
  useRef: (current: unknown) => ({ current }),
  useEffect: () => {}
}));
vi.mock("../../hooks/useSession", () => ({ useSession: () => ({ session: null, userLogin: null }) }));
vi.mock("../../hooks/useSavedProjects", () => ({ useSavedProjects: () => ({ savedProjects: [] }) }));
vi.mock("../../hooks/useAutosaveDraft", () => ({
  useAutosaveDraft: (_session: unknown, _draft: unknown, accept: typeof hooks.accept) => {
    hooks.accept = accept;
    return {};
  }
}));
import { useStudioState } from "../../hooks/useStudioState";
import { CLASSIC_RUSSIAN_STOVE } from "../../domain/classicRussianStove";
import { READY_PROJECTS } from "../../domain/projects";
import { CLASSIC_ARCH_NAMES, classicArchAssembly, archAssemblyFrame } from "../builder/classicArchAssembly";
const render = () => {
  hooks.cursor = 0;
  return useStudioState();
};
beforeEach(() => {
  hooks.slots = [];
  vi.stubGlobal("window", { location: { search: "" }, confirm: () => true });
});
it("recognizes a saved classic copy without template ID, and scrubs without changing editor or materials", () => {
  let studio = render();
  studio.loadProject({ ...structuredClone(CLASSIC_RUSSIAN_STOVE), id: "saved-copy", ownerLogin: "owner" });
  studio = render();
  expect(studio.demoProjectId).toBeNull();
  expect(studio.showTeplushkaGuide).toBe(false);
  const before = JSON.stringify(hooks.slots);
  const materials = studio.materials;
  for (const name of CLASSIC_ARCH_NAMES) {
    const assembly = classicArchAssembly(Object.values(studio.rows).flat(), name)!;
    expect(assembly).not.toBeNull();
    archAssemblyFrame(assembly, assembly.steps.length - 1);
    archAssemblyFrame(assembly, 0);
  }
  expect(JSON.stringify(hooks.slots)).toBe(before);
  expect(render().materials).toEqual(materials);
});
it("invalidates mounted scene state on same-project reload, reset and accepted draft only", () => {
  let studio = render();
  const revision = studio.sceneRevision;
  studio.loadProject(CLASSIC_RUSSIAN_STOVE);
  studio = render();
  expect(studio.sceneRevision).toBe(revision + 1);
  studio.loadProject(CLASSIC_RUSSIAN_STOVE);
  studio = render();
  expect(studio.sceneRevision).toBe(revision + 2);
  const draft = {
    parameters: studio.parameters,
    rowCount: studio.rowCount,
    currentRow: 3,
    lockedRows: studio.lockedRows,
    rows: studio.rows
  };
  studio.reset();
  studio = render();
  expect(studio.sceneRevision).toBe(revision + 3);
  expect(hooks.accept(draft)).toBe(true);
  studio = render();
  expect(studio.sceneRevision).toBe(revision + 4);
  expect(studio.currentRow).toBe(3);
  studio.addRow();
  studio = render();
  vi.stubGlobal("window", { location: { search: "" }, confirm: () => false });
  expect(hooks.accept(draft)).toBe(false);
  expect(render().sceneRevision).toBe(studio.sceneRevision);
});
it("keeps restored Teplushka detection separate from classic assemblies", () => {
  let studio = render();
  studio.loadProject({
    ...READY_PROJECTS.find((p) => p.id === "russian-stove-hob")!,
    id: "saved-teplushka",
    ownerLogin: "owner"
  });
  studio = render();
  expect(studio.showTeplushkaGuide).toBe(true);
  expect(
    CLASSIC_ARCH_NAMES.every((name) => classicArchAssembly(Object.values(studio.rows).flat(), name) === null)
  ).toBe(true);
});
