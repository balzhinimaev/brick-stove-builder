import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { DraftSnapshot } from "../../domain/editor";
import { initialEditorState } from "../../domain/editor/state";
import * as projectFile from "../../storage/projectFile";
import * as workspaceStorage from "../../storage/workspace";
import { indexedWorkspace, newLocalProject } from "../../storage/workspace";

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

let snapshot: DraftSnapshot, factory: IDBFactory, navigated: boolean | undefined, login: string;
function render() {
  hooks.cursor = 0;
  // biome-ignore lint/correctness/useHookAtTopLevel: this Node harness explicitly owns and replays the mocked hook slots; no React component is rendered.
  const workspace = useLocalWorkspace(login, snapshot, (next, navigate) => {
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
  login = "";
  vi.stubGlobal("indexedDB", factory);
  vi.stubGlobal("localStorage", { getItem: () => null });
  vi.stubGlobal("window", { addEventListener: () => {}, removeEventListener: () => {}, prompt: () => "Safe copy" });
  vi.stubGlobal("document", { addEventListener: () => {}, removeEventListener: () => {}, hidden: false });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

it.each(["active", "read"] as const)(
  "ignores save, save-copy, checkpoint and rename while initial %s lookup is pending",
  async (method) => {
    const store = indexedWorkspace(factory);
    const existing = newLocalProject("guest", "Existing stove", initialEditorState());
    await store.write(existing, true);
    const gate = deferred();
    const original = store[method];
    const write = vi.fn(store.write);
    vi.spyOn(workspaceStorage, "indexedWorkspace").mockReturnValue({
      ...store,
      write,
      [method]: async (id: string) => {
        await gate.promise;
        return original(id);
      }
    });
    snapshot = { ...initialEditorState(), rows: {} };
    const value = render();
    expect(value.ready).toBe(false);
    const saving = Promise.all([value.save(), value.saveCopy(), value.saveVersion(), value.rename()]);
    gate.resolve();
    await saving;
    const loaded = await boot();
    expect(loaded.info?.id).toBe(existing.id);
    expect(snapshot.rows).toEqual(existing.snapshot.rows);
    expect((await store.read(existing.id))?.snapshot).toEqual(existing.snapshot);
    expect(write).not.toHaveBeenCalled();
  }
);

it("ignores current and stale save/copy/checkpoint/rename callbacks while another account is hydrating", async () => {
  const store = indexedWorkspace(factory);
  const guest = newLocalProject("guest", "Guest stove", initialEditorState());
  const account = newLocalProject("alice", "Account stove", { ...initialEditorState(), rows: {} });
  await store.write(guest, true);
  await store.write(account, true);
  const gate = deferred();
  const write = vi.fn(store.write);
  vi.spyOn(workspaceStorage, "indexedWorkspace").mockReturnValue({
    ...store,
    write,
    active: async (ns) => {
      if (ns === "alice") await gate.promise;
      return store.active(ns);
    }
  });
  const oldWorkspace = await boot();
  login = "alice";
  // This render still has the previous account's ready state until its effect runs.
  const value = render();
  expect(value.ready).toBe(true);
  const pending = Promise.all([
    oldWorkspace.save(),
    value.save(),
    oldWorkspace.saveCopy(),
    value.saveCopy(),
    oldWorkspace.saveVersion(),
    value.saveVersion(),
    oldWorkspace.rename(),
    value.rename()
  ]);
  gate.resolve();
  await pending;
  await boot();
  expect((await store.read(account.id))?.snapshot).toEqual(account.snapshot);
  expect(write.mock.calls.filter(([doc]) => doc.id === account.id)).toHaveLength(0);
});

it("ignores save, save-copy, checkpoint and rename while a project switch persists the outgoing edits", async () => {
  const store = indexedWorkspace(factory);
  const write = vi.fn(store.write);
  vi.spyOn(workspaceStorage, "indexedWorkspace").mockReturnValue({ ...store, write });
  let value = await boot();
  await value.save();
  value = render();
  const id = value.info!.id;
  snapshot = { ...snapshot, lockedRows: [] };
  value = render();
  const gate = deferred();
  write.mockClear();
  write.mockImplementationOnce(async (...args) => {
    await gate.promise;
    await store.write(...args);
  });
  const switching = value.create("Other stove", { ...initialEditorState(), rows: {} });
  const saving = Promise.all([value.save(), value.saveCopy(), value.saveVersion(), value.rename()]);
  gate.resolve();
  expect(await switching).toBe(true);
  await saving;
  value = render();
  expect(value.info?.id).not.toBe(id);
  expect(value.info?.title).toBe("Other stove");
  expect(snapshot.rows).toEqual({});
  expect(write.mock.calls.filter(([doc]) => doc.id === id)).toHaveLength(1);
  expect(write.mock.calls.some(([doc]) => doc.kind === "checkpoint" && doc.title.endsWith("Safe copy"))).toBe(false);
});

it("allows explicit recovery save after loading fails", async () => {
  const store = indexedWorkspace(factory);
  vi.spyOn(workspaceStorage, "indexedWorkspace").mockReturnValue({
    ...store,
    active: vi.fn().mockRejectedValueOnce(new Error("Temporarily unavailable"))
  });
  let value = await boot();
  expect(value.state).toBe("error");
  snapshot = { ...snapshot, lockedRows: [] };
  value = render();
  await value.save();
  value = render();
  expect(value.state).toBe("saved");
  expect((await store.read(value.info!.id))?.snapshot.lockedRows).toEqual([]);
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

it("saves an explicit checkpoint of the latest edits after hydration", async () => {
  let value = await boot();
  await value.save();
  value = render();
  const id = value.info!.id;
  snapshot = { ...snapshot, lockedRows: [] };
  value = render();
  await value.saveVersion();
  value = render();
  const saved = value.projects.find((project) => project.kind === "checkpoint" && project.parentId === id);
  expect(saved?.title).toBe("Новая печь · Safe copy");
  expect((await indexedWorkspace(factory).read(saved!.id))?.snapshot).toEqual(snapshot);
  expect(value.info?.id).toBe(id);
});

it("renames the hydrated project while preserving its identity and latest edits", async () => {
  let value = await boot();
  await value.save();
  value = render();
  const id = value.info!.id;
  snapshot = { ...snapshot, lockedRows: [] };
  value = render();
  await value.rename();
  value = render();
  expect(value.info?.id).toBe(id);
  expect(value.info?.title).toBe("Safe copy");
  expect((await indexedWorkspace(factory).read(id))?.snapshot).toEqual(snapshot);
});

it("reopening the active project preserves unsaved edits without a false cross-tab conflict", async () => {
  let value = await boot();
  await value.save();
  value = render();
  const id = value.info!.id;
  snapshot = { ...snapshot, lockedRows: [], currentRow: 3 };
  value = render();
  const edited = structuredClone(snapshot);
  await value.open(value.info!);
  value = render();
  expect(value.info?.id).toBe(id);
  expect(snapshot).toEqual(edited);
  expect(value.state).toBe("saved");
  expect(value.error).toBe("");
  expect((await indexedWorkspace(factory).read(id))?.snapshot).toEqual(edited);
});

it("exports a restored long-title checkpoint as an importable project without changing its source", async () => {
  const store = indexedWorkspace(factory);
  const original = newLocalProject("guest", "П".repeat(200), initialEditorState());
  const saved = workspaceStorage.checkpoint(original, "К".repeat(200));
  await store.write(original, true);
  await store.write(saved);
  const download = vi.spyOn(projectFile, "downloadFile").mockImplementation(() => {});
  let value = await boot();
  await value.open(saved);
  value = render();
  expect(value.info?.id).not.toBe(saved.id);
  expect(value.info?.title).toMatch(/ · восстановлено$/);
  value.exportProject();
  const exported = projectFile.parseProjectFile(download.mock.calls[0][1]);
  expect(exported.snapshot).toEqual(saved.snapshot);
  expect(exported.title).toBe(value.info?.title);
  expect(await store.read(saved.id)).toEqual({ ...saved, viewRow: saved.snapshot.currentRow });
  expect(await value.importProject(download.mock.calls[0][1])).toBe(true);
  expect(snapshot).toEqual(saved.snapshot);
});

it("does not rename another account when the account changes during the outgoing save", async () => {
  const store = indexedWorkspace(factory);
  const guest = newLocalProject("guest", "Guest stove", initialEditorState());
  const account = newLocalProject("alice", "Account stove", { ...initialEditorState(), rows: {} });
  await store.write(guest, true);
  await store.write(account, true);
  const gate = deferred();
  const started = deferred();
  const write = vi.fn(store.write);
  vi.spyOn(workspaceStorage, "indexedWorkspace").mockReturnValue({ ...store, write });
  let value = await boot();
  snapshot = { ...snapshot, lockedRows: [] };
  value = render();
  write.mockImplementationOnce(async (...args) => {
    started.resolve();
    await gate.promise;
    await store.write(...args);
  });
  const renaming = value.rename();
  await started.promise;
  login = "alice";
  render();
  gate.resolve();
  await renaming;
  value = await boot();
  expect(value.info?.id).toBe(account.id);
  expect(value.info?.title).toBe("Account stove");
  expect((await store.read(account.id))?.title).toBe("Account stove");
  expect((await store.read(guest.id))?.title).toBe("Guest stove");
});

it("does not rename a new copy when it replaces the project during the outgoing save", async () => {
  const store = indexedWorkspace(factory);
  const original = newLocalProject("guest", "Original stove", initialEditorState());
  await store.write(original, true);
  const gate = deferred();
  const started = deferred();
  const write = vi.fn(store.write);
  vi.spyOn(workspaceStorage, "indexedWorkspace").mockReturnValue({ ...store, write });
  let value = await boot();
  snapshot = { ...snapshot, lockedRows: [] };
  value = render();
  vi.spyOn(window, "prompt").mockReturnValueOnce("Renamed original").mockReturnValueOnce("Separate copy");
  write.mockImplementationOnce(async (...args) => {
    started.resolve();
    await gate.promise;
    await store.write(...args);
  });
  const renaming = value.rename();
  await started.promise;
  const copying = value.saveCopy();
  gate.resolve();
  await Promise.all([renaming, copying]);
  value = render();
  expect(value.info?.id).not.toBe(original.id);
  expect(value.info?.title).toBe("Separate copy");
  expect((await store.read(value.info!.id))?.title).toBe("Separate copy");
  expect((await store.read(original.id))?.title).toBe("Original stove");
  expect((await store.read(original.id))?.snapshot.lockedRows).toEqual([]);
  expect(value.state).toBe("saved");
});

it.each(["debounce", "visibility"])("ignores an outgoing account's failed %s autosave", async (trigger) => {
  const store = indexedWorkspace(factory);
  const guest = newLocalProject("guest", "Guest stove", initialEditorState());
  await store.write(guest, true);
  const writeGate = deferred();
  const started = deferred();
  const loading = deferred();
  const loadGate = deferred();
  const write = vi.fn(store.write);
  vi.spyOn(workspaceStorage, "indexedWorkspace").mockReturnValue({
    ...store,
    write,
    active: async (ns) => {
      if (ns === "alice") {
        loading.resolve();
        await loadGate.promise;
      }
      return store.active(ns);
    }
  });
  const listeners = new Map<string, () => void>();
  vi.stubGlobal("document", {
    hidden: true,
    addEventListener: (name: string, callback: () => void) => listeners.set(name, callback),
    removeEventListener: (name: string) => listeners.delete(name)
  });
  await boot();
  let autosave: (() => void) | undefined;
  const realTimeout = globalThis.setTimeout;
  vi.spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void, delay: number) => {
    if (delay === 500) {
      autosave = callback;
      return realTimeout(() => {}, 0);
    }
    return realTimeout(callback, delay);
  }) as typeof setTimeout);
  snapshot = { ...snapshot, lockedRows: [] };
  render();
  write.mockImplementationOnce(async () => {
    started.resolve();
    await writeGate.promise;
    throw new Error("Outgoing save failed");
  });
  if (trigger === "debounce") autosave!();
  else listeners.get("visibilitychange")!();
  await started.promise;
  login = "alice";
  render();
  writeGate.resolve();
  await loading.promise;
  // Let the rejected autosave's outer catch settle while Alice is still loading.
  await new Promise((resolve) => realTimeout(resolve, 0));
  const value = render();
  loadGate.resolve();
  await boot();
  expect(value.state).toBe("loading");
  expect(value.error).toBe("");
});
