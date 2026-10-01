import { afterEach, expect, it, vi } from "vitest";
import { useSavedProjects } from "../useSavedProjects";
import { enqueuePendingOp, loadPendingOps, savePendingOps, flushOps, remapPendingOps } from "../../storage/offline";
import { updateSavedProject } from "../../api/client";
import type { ReadyProject } from "../../domain/types";
import { authFailureKey } from "../../api/authFailure";
import { isSaveShortcut } from "../../lib/shortcuts";

vi.mock("react", () => ({
  useCallback: (fn: unknown) => fn,
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) => [initial, vi.fn()],
  useEffect: vi.fn()
}));
vi.mock("../../api/client", () => ({
  createSavedProject: vi.fn(),
  updateSavedProject: vi.fn(async (_id, p) => p),
  deleteSavedProject: vi.fn(),
  fetchSavedProjects: vi.fn(async () => []),
  isAuthError: () => false,
  isPermanentError: () => false
}));
const project = { id: "p", accent: "v1" } as ReadyProject;
function storage() {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k),
    setItem: (k: string, v: string) => data.set(k, v)
  });
  vi.stubGlobal("window", { alert: vi.fn(), setTimeout: vi.fn(() => 1) });
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("online update joins old queued update, including a save during flush", async () => {
  storage();
  enqueuePendingOp("ordered", { kind: "update", id: "p", project, queuedAt: 1 });
  let release!: () => void;
  vi.mocked(updateSavedProject).mockImplementationOnce(async (_id, p) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    return p;
  });
  const hook = useSavedProjects({ login: "ordered", token: "test" });
  await hook.updateProject("p", { ...project, accent: "v2" }, "test");
  await hook.updateProject("p", { ...project, accent: "v3" }, "test");
  expect(updateSavedProject).toHaveBeenCalledTimes(1);
  release();
  await vi.waitFor(() => expect(loadPendingOps("ordered")).toEqual([]));
  expect(vi.mocked(updateSavedProject).mock.calls.map((call) => call[1].accent)).toEqual(["v1", "v2", "v3"]);
});
it("quota failure rejects new saves instead of acknowledging a lost queue", async () => {
  storage();
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => {
      throw new DOMException("full", "QuotaExceededError");
    }
  });
  const hook = useSavedProjects({ login: "quota", token: "test" });
  expect(await hook.saveProject(project, "test")).toBeNull();
  expect(loadPendingOps("quota")).toEqual([]);
  expect(window.alert).toHaveBeenCalled();
  expect(updateSavedProject).not.toHaveBeenCalled();
});
it("failed checkpoint retains remapped queue in memory", () => {
  storage();
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => {
      throw new Error("quota");
    }
  });
  const ops = [{ kind: "delete" as const, id: "remote", queuedAt: 1 }];
  savePendingOps("checkpoint", ops);
  expect(loadPendingOps("checkpoint")).toEqual(ops);
});
it("successful create remaps failed tail and concurrently queued operations for retry", async () => {
  const update = { kind: "update" as const, id: "tmp", project: { ...project, id: "tmp" }, queuedAt: 1 };
  const exec = {
    create: async () => ({ ...project, id: "remote" }),
    update: vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(project),
    remove: vi.fn(),
    isAuth: () => false,
    isPermanent: () => false
  };
  const result = await flushOps([{ kind: "create", project: update.project, queuedAt: 0 }, update], exec);
  const tail = [...result.remaining, ...remapPendingOps([{ kind: "delete", id: "tmp", queuedAt: 2 }], result.idMap)];
  await flushOps(tail, exec);
  expect(exec.update.mock.calls.map((call) => call[0])).toEqual(["remote", "remote"]);
  expect(exec.remove).toHaveBeenCalledWith("remote");
});
it("auth distinguishes credentials from unavailable service", () => {
  for (const status of [429, 500, 503]) expect(authFailureKey("login", status)).toBe("authUnavailable");
  expect(authFailureKey("login", 401)).toBe("authBadCredentials");
  expect(authFailureKey("register", 409)).toBe("authTaken");
});
it("save shortcut supports RU and Mac without intercepting undo or composition", () => {
  const event = {
    key: "ы",
    code: "KeyS",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false
  };
  expect(isSaveShortcut(event)).toBe(true);
  expect(isSaveShortcut({ ...event, ctrlKey: false, metaKey: true })).toBe(true);
  expect(isSaveShortcut({ ...event, key: "z", code: "KeyZ" })).toBe(false);
  expect(isSaveShortcut({ ...event, isComposing: true })).toBe(false);
  expect(isSaveShortcut({ ...event, altKey: true })).toBe(false);
});
it("retries persistence of an empty checkpoint after storage recovers", async () => {
  storage();
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => {
      throw new Error("quota");
    }
  });
  savePendingOps("recovered", []);
  const setItem = vi.fn();
  vi.stubGlobal("localStorage", { getItem: () => null, setItem });
  await useSavedProjects({ login: "recovered", token: "test" }).flushPending();
  expect(setItem).toHaveBeenCalledWith("brick-stove-pending-ops:recovered", "[]");
});
