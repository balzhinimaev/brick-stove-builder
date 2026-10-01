import { afterEach, expect, it, vi } from "vitest";
import { useSavedProjects } from "../useSavedProjects";
import { enqueuePendingOp, loadPendingOps, savePendingOps, flushOps, remapPendingOps } from "../../storage/offline";
import { updateSavedProject, fetchSavedProjects } from "../../api/client";
import type { ReadyProject } from "../../domain/types";
import { authFailureKey } from "../../api/authFailure";
import { isSaveShortcut } from "../../lib/shortcuts";

const harness = vi.hoisted(() => ({ slots: [] as unknown[], index: 0 }));
function render(session: { login: string; token: string }, onAuthFailure?: () => void) {
  harness.index = 0;
  return useSavedProjects(session, undefined, onAuthFailure);
}
vi.mock("react", () => ({
  useCallback: (fn: unknown) => fn,
  useRef: (current: unknown) => {
    const i = harness.index++;
    if (!harness.slots[i]) harness.slots[i] = { current };
    return harness.slots[i];
  },
  useState: (initial: unknown) => {
    const i = harness.index++;
    if (!(i in harness.slots)) harness.slots[i] = initial;
    return [
      harness.slots[i],
      (next: unknown) => {
        harness.slots[i] = typeof next === "function" ? next(harness.slots[i]) : next;
      }
    ];
  },
  useEffect: vi.fn()
}));
vi.mock("../../api/client", () => ({
  ApiError: class extends Error {},
  createSavedProject: vi.fn(),
  updateSavedProject: vi.fn(async (_id, p) => p),
  deleteSavedProject: vi.fn(),
  fetchSavedProjects: vi.fn(async () => []),
  isAuthError: (e: unknown) => e === "old401",
  isPermanentError: (e: unknown) => e === "permanent400"
}));
const project = { id: "p", accent: "v1" } as ReadyProject;
function storage() {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k),
    setItem: (k: string, v: string) => data.set(k, v)
  });
  vi.stubGlobal("window", { alert: vi.fn(), setTimeout: vi.fn(() => 1), clearTimeout: vi.fn() });
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  harness.slots = [];
  harness.index = 0;
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
  for (const status of [500, 503]) expect(authFailureKey("login", status)).toBe("authUnavailable");
  for (const mode of ["login", "register"] as const) expect(authFailureKey(mode, 429)).toBe("authRateLimited");
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

it("old token 401 cannot invalidate the new session with the same login", async () => {
  storage();
  let reject!: (e: unknown) => void;
  vi.mocked(fetchSavedProjects).mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      })
  );
  const logout = vi.fn();
  const old = render({ login: "same", token: "token1" }, logout);
  const pending = old.flushPending();
  render({ login: "same", token: "token2" }, logout);
  reject("old401");
  await pending;
  expect(logout).not.toHaveBeenCalled();
});
it("old token GET cannot overwrite a new session's list", async () => {
  storage();
  let resolve!: (p: ReadyProject[]) => void;
  vi.mocked(fetchSavedProjects).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const pending = render({ login: "same", token: "token1" }).flushPending();
  render({ login: "same", token: "token2" });
  resolve([project]);
  await pending;
  expect(render({ login: "same", token: "token2" }).savedProjects).toEqual([]);
});
it("GET cannot overwrite an optimistic revision even with an empty queue", async () => {
  storage();
  const session = { login: "revision", token: "test" };
  // Install an existing card through a completed GET.
  vi.mocked(fetchSavedProjects).mockResolvedValueOnce([project]);
  await render(session).flushPending();
  let resolve!: (p: ReadyProject[]) => void;
  vi.mocked(fetchSavedProjects).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const hook = render(session);
  const pending = hook.flushPending();
  hook.replaceProject({ ...project, accent: "optimistic" });
  resolve([project]);
  await pending;
  expect(render(session).savedProjects[0].accent).toBe("optimistic");
});
it("quota failure on delete preserves the card and pending count", async () => {
  storage();
  const session = { login: "delete-quota", token: "test" };
  vi.mocked(fetchSavedProjects).mockResolvedValueOnce([project]);
  await render(session).flushPending();
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => {
      throw new Error("quota");
    }
  });
  expect(await render(session).removeProject("p", "test")).toBe(false);
  const hook = render(session);
  expect(hook.savedProjects).toEqual([project]);
  expect(hook.pendingCount).toBe(0);
});
it("permanent create/update failures retain the operation and its tail", async () => {
  for (const kind of ["create", "update"] as const) {
    const op = { kind, id: "p", project, queuedAt: 1 };
    const tail = { kind: "delete" as const, id: "p", queuedAt: 2 };
    const reject = vi.fn().mockRejectedValue(new Error("400"));
    const result = await flushOps([op, tail], {
      create: reject,
      update: reject,
      remove: vi.fn(),
      isPermanent: () => true,
      isAuth: () => false,
      isNotFound: () => false
    });
    expect(result.remaining).toEqual([{ ...op, rejected: {} }, tail]);
    expect(result.permanentFailure).toBe(true);
  }
});

it("permanent rejection is visible and does not schedule silent retries", async () => {
  storage();
  const session = { login: "visible-rejection", token: "test" };
  enqueuePendingOp(session.login, { kind: "update", id: "p", project, queuedAt: 1 });
  vi.mocked(updateSavedProject).mockRejectedValueOnce("permanent400");
  await render(session).flushPending();
  const hook = render(session);
  expect(hook.syncIssue).toBe("syncRejected");
  expect(hook.pendingCount).toBe(1);
  expect(loadPendingOps(session.login)).toHaveLength(1);
  expect(window.setTimeout).not.toHaveBeenCalled();
  expect(fetchSavedProjects).not.toHaveBeenCalled();
});

it("failed empty checkpoint is not durable success and recovers without replaying the write", async () => {
  storage();
  const session = { login: "empty-checkpoint-quota", token: "test" };
  enqueuePendingOp(session.login, { kind: "update", id: "p", project, queuedAt: 1 });
  const originalStorage = localStorage;
  const durableBefore = localStorage.getItem("brick-stove-pending-ops:" + session.login);
  vi.mocked(updateSavedProject).mockImplementationOnce(async (_id, p) => {
    vi.stubGlobal("localStorage", {
      getItem: originalStorage.getItem,
      setItem: () => {
        throw new Error("quota on clear");
      }
    });
    return p;
  });
  await render(session).flushPending();
  expect(loadPendingOps(session.login)).toEqual([]);
  expect(localStorage.getItem("brick-stove-pending-ops:" + session.login)).toBe(durableBefore);
  expect(render(session).syncIssue).toBe("syncCheckpointFailed");
  expect(fetchSavedProjects).not.toHaveBeenCalled();
  await render(session).flushPending();
  expect(render(session).syncIssue).toBe("syncCheckpointFailed");
  expect(fetchSavedProjects).not.toHaveBeenCalled();
  vi.stubGlobal("localStorage", originalStorage);
  await render(session).flushPending();
  expect(render(session).syncIssue).toBeNull();
  expect(localStorage.getItem("brick-stove-pending-ops:" + session.login)).toBe("[]");
  expect(updateSavedProject).toHaveBeenCalledTimes(1);
  expect(fetchSavedProjects).toHaveBeenCalledTimes(1);
});

it("does not lose an independent write appended during a permanent rejection", async () => {
  storage();
  const session = { login: "append-after-rejection", token: "test" };
  let reject!: (reason: unknown) => void;
  vi.mocked(updateSavedProject).mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      })
  );
  enqueuePendingOp(session.login, { kind: "update", id: "p", project, queuedAt: 1 });
  const pending = render(session).flushPending();
  await render(session).updateProject("other", { ...project, id: "other" }, "test");
  reject("permanent400");
  await pending;
  // The queued rerun proceeds without retrying the rejected first project.
  for (let i = 0; i < 10; i++) await Promise.resolve();
  expect(updateSavedProject).toHaveBeenCalledTimes(2);
  expect(updateSavedProject).toHaveBeenLastCalledWith("other", { ...project, id: "other" }, "test");
  expect(loadPendingOps(session.login)).toEqual([{ kind: "update", id: "p", project, queuedAt: 1, rejected: {} }]);
  expect(render(session).syncIssue).toBe("syncRejected");
});
