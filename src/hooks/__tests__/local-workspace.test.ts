import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { DraftSnapshot } from "../../domain/editor";
import { initialEditorState } from "../../domain/editor/state";
import { indexedWorkspace } from "../../storage/workspace";

// Existing project practice: drive hook state/effects in Node, without DOM/browser rendering.
const hooks = vi.hoisted(() => ({
  slots: [] as { value?: unknown; deps?: unknown[]; cleanup?: () => void }[],
  cursor: 0,
  effects: [] as { slot: number; run: () => void | (() => void) }[]
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const i = hooks.cursor++;
    if (!hooks.slots[i]) hooks.slots[i] = { value: typeof initial === "function" ? initial() : initial };
    return [
      hooks.slots[i].value,
      (value: unknown) => {
        hooks.slots[i].value = typeof value === "function" ? value(hooks.slots[i].value) : value;
      }
    ];
  },
  useRef: (initial: unknown) => {
    const i = hooks.cursor++;
    hooks.slots[i] ??= { value: { current: initial } };
    return hooks.slots[i].value;
  },
  useCallback: (callback: unknown, deps: unknown[]) => {
    const i = hooks.cursor++,
      old = hooks.slots[i];
    if (!old || deps.some((d, j) => !Object.is(d, old.deps?.[j]))) hooks.slots[i] = { value: callback, deps };
    return hooks.slots[i].value;
  },
  useEffect: (run: () => void | (() => void), deps: unknown[]) => {
    const i = hooks.cursor++,
      old = hooks.slots[i];
    if (!old || deps.some((d, j) => !Object.is(d, old.deps?.[j]))) {
      hooks.slots[i] = { deps, cleanup: old?.cleanup };
      hooks.effects.push({ slot: i, run });
    }
  }
}));
import { useLocalWorkspace } from "../useLocalWorkspace";

let snapshot: DraftSnapshot, factory: IDBFactory, navigated: boolean | undefined;
function render() {
  hooks.cursor = 0;
  // biome-ignore lint/correctness/useHookAtTopLevel: this Node harness explicitly owns and replays the mocked hook slots; no React component is rendered.
  const workspace = useLocalWorkspace("", snapshot, (next, navigate) => {
    snapshot = next;
    navigated = navigate;
  });
  for (const { slot, run } of hooks.effects.splice(0)) {
    hooks.slots[slot].cleanup?.();
    const cleanup = run();
    hooks.slots[slot].cleanup = cleanup || undefined;
  }
  return workspace;
}
async function boot() {
  for (let i = 0; i < 100; i++) {
    const value = render();
    if (value.ready) return value;
    await new Promise((r) => setTimeout(r, 4));
  }
  throw new Error("Workspace did not hydrate");
}
function cleanup() {
  for (const s of hooks.slots) s.cleanup?.();
  hooks.slots = [];
  hooks.cursor = 0;
  hooks.effects = [];
}
beforeEach(() => {
  cleanup();
  snapshot = initialEditorState();
  factory = new IDBFactory();
  navigated = undefined;
  vi.stubGlobal("indexedDB", factory);
  vi.stubGlobal("localStorage", { getItem: () => null });
  vi.stubGlobal("window", { addEventListener: () => {}, removeEventListener: () => {}, prompt: () => "Safe copy" });
  vi.stubGlobal("document", { addEventListener: () => {}, removeEventListener: () => {}, hidden: false });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("migrates the old draft without deleting it or overriding a showcase deep-link", async () => {
  const legacy = { ...initialEditorState(), currentRow: 3, updatedAt: 1 };
  const get = vi.fn(() => JSON.stringify(legacy));
  vi.stubGlobal("localStorage", { getItem: get });
  const value = await boot();
  expect(value.info?.title).toBe("Восстановленный черновик");
  expect(snapshot.currentRow).toBe(3);
  expect(navigated).toBe(false);
  expect(get).toHaveBeenCalledWith("brick-stove-draft:anon");
  expect(await indexedWorkspace(factory).active("guest")).toBe(value.info?.id);
});

it("preserves edits in A across B, a restart, and restore; repeated save has one project identity", async () => {
  let value = await boot();
  await value.save();
  value = render();
  const id = value.info!.id;
  snapshot = { ...snapshot, currentRow: 3, lockedRows: [] };
  value = render();
  await value.save();
  value = render();
  expect(value.info?.id).toBe(id);
  const edited = structuredClone(snapshot);
  expect(
    await value.create("B", { ...initialEditorState(), rows: {}, lockedRows: [], rowCount: 1, currentRow: 1 })
  ).toBe(true);
  value = render();
  const bId = value.info!.id;
  expect(navigated).toBe(true);
  expect(value.projects.filter((p) => p.kind === "project")).toHaveLength(2);
  cleanup();
  snapshot = initialEditorState();
  value = await boot();
  expect(value.info?.id).toBe(bId);
  expect(snapshot.rows).toEqual({});
  await value.open(value.projects.find((p) => p.id === id)!);
  value = render();
  expect(snapshot).toEqual(edited);
  expect(value.info?.id).toBe(id);
  expect(value.projects.some((p) => p.kind === "checkpoint" && p.parentId === id)).toBe(true);
});

it("keeps the current document on a failed import or cross-tab save, and permits a separate rescue copy", async () => {
  let value = await boot();
  await value.save();
  value = render();
  const id = value.info!.id,
    previous = structuredClone(snapshot);
  expect(await value.importProject('{"format":"wrong"}')).toBe(false);
  expect(snapshot).toEqual(previous);
  value = render();
  const store = indexedWorkspace(factory),
    other = (await store.read(id))!;
  await store.write({ ...other, title: "Other tab", updatedAt: other.updatedAt + 100 }, true, other.updatedAt);
  snapshot = { ...snapshot, lockedRows: [] };
  value = render();
  await value.save();
  value = render();
  expect(value.state).toBe("error");
  expect((await store.read(id))?.title).toBe("Other tab");
  await value.saveCopy();
  value = render();
  expect(value.info?.id).not.toBe(id);
  expect(value.info?.title).toBe("Safe copy");
  expect((await store.read(value.info!.id))?.snapshot.lockedRows).toEqual([]);
});

it("retains the account project identity across a restart but never copies it to a new branch", async () => {
  let value = await boot();
  await value.save();
  value = render();
  const id = value.info!.id;
  await value.linkRemote(id, "remote-project");
  value = render();
  cleanup();
  snapshot = initialEditorState();
  value = await boot();
  expect(value.info?.remoteId).toBe("remote-project");
  await value.saveCopy();
  value = render();
  expect(value.info?.remoteId).toBeUndefined();
  expect((await indexedWorkspace(factory).read(id))?.remoteId).toBe("remote-project");
});
