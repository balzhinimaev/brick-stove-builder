import { beforeEach, expect, it, vi } from "vitest";
import type { DraftSnapshot } from "../../domain/editor";

// Hook harness: exercise studio/editor actions without a DOM, WebGL or browser.
const hooks = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  accept: (_draft: DraftSnapshot): boolean => false,
  storeError: false
}));
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
vi.mock("../../hooks/useLocalWorkspace", () => ({
  useLocalWorkspace: (_login: unknown, _draft: unknown, load: (d: DraftSnapshot, navigate?: boolean) => void) => {
    hooks.accept = (draft) => {
      load(draft, false);
      return true;
    };
    return {
      state: "saved",
      ready: true,
      projects: [],
      create: async (_title: string, draft: DraftSnapshot) => {
        if (hooks.storeError) return false;
        load(draft, true);
        return true;
      }
    };
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
  hooks.storeError = false;
  vi.stubGlobal("window", { location: { search: "" }, confirm: () => true });
});
it("recognizes a saved classic copy without template ID, and scrubs without changing editor or materials", async () => {
  let studio = render();
  await studio.loadProject({ ...structuredClone(CLASSIC_RUSSIAN_STOVE), id: "saved-copy", ownerLogin: "owner" });
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
it("invalidates mounted scene state on same-project reload, reset and persisted replacement only", async () => {
  let studio = render();
  const revision = studio.sceneRevision;
  await studio.loadProject(CLASSIC_RUSSIAN_STOVE);
  studio = render();
  expect(studio.sceneRevision).toBe(revision + 1);
  await studio.loadProject(CLASSIC_RUSSIAN_STOVE);
  studio = render();
  expect(studio.sceneRevision).toBe(revision + 2);
  const draft = {
    parameters: studio.parameters,
    rowCount: studio.rowCount,
    currentRow: 3,
    lockedRows: studio.lockedRows,
    rows: studio.rows
  };
  await studio.reset();
  studio = render();
  expect(studio.sceneRevision).toBe(revision + 3);
  expect(hooks.accept(draft)).toBe(true);
  studio = render();
  expect(studio.sceneRevision).toBe(revision + 4);
  expect(studio.currentRow).toBe(3);
  studio.addRow();
  studio = render();
  hooks.storeError = true;
  await studio.loadProject(CLASSIC_RUSSIAN_STOVE);
  expect(render().sceneRevision).toBe(studio.sceneRevision);
});
it("keeps restored Teplushka detection separate from classic assemblies", async () => {
  let studio = render();
  await studio.loadProject({
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
