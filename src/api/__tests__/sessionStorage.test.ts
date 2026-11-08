import { afterEach, expect, it, vi } from "vitest";
import { clearSession, loadSession, saveSession } from "../client";

afterEach(() => vi.unstubAllGlobals());

it("restores a complete stored session", () => {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => (key === "brick-stove-token" ? "test-token" : "tester")
  });
  expect(loadSession()).toEqual({ login: "tester", token: "test-token" });
});

it.each(["brick-stove-token", "brick-stove-login"])("ignores a session missing %s", (missing) => {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => (key === missing ? null : "stored-value")
  });
  expect(loadSession()).toBeNull();
});

it.each([1, 2])("allows guest startup when storage read %s is denied", (failedRead) => {
  let reads = 0;
  vi.stubGlobal("localStorage", {
    getItem: () => {
      if (++reads === failedRead) throw new DOMException("Storage blocked", "SecurityError");
      return "stored-value";
    }
  });
  expect(loadSession()).toBeNull();
});

it("allows guest startup when localStorage is unavailable", () => {
  vi.stubGlobal("localStorage", undefined);
  expect(loadSession()).toBeNull();
});

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key)
  };
}

it.each([true, false])(
  "persists and restores the selected remember=%s session without stale account keys",
  (remember) => {
    const local = storage();
    const tab = storage();
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", tab);
    saveSession({ login: "old", token: "old-token" }, !remember);
    const session = { login: "new", token: "new-token" };
    saveSession(session, remember);
    expect(loadSession()).toEqual(session);
    expect((remember ? local : tab).getItem("brick-stove-token")).toBe("new-token");
    expect((remember ? tab : local).getItem("brick-stove-token")).toBeNull();
    // A reload restores the tab, but a new tab has only the persistent storage.
    vi.stubGlobal("sessionStorage", storage());
    expect(loadSession()).toEqual(remember ? session : null);
    clearSession();
    expect(loadSession()).toBeNull();
  }
);

it("does not leave a partial credential pair after a failed storage write", () => {
  const local = storage();
  const write = local.setItem;
  local.setItem = (key, value) => {
    if (key === "brick-stove-login") throw new Error("quota");
    return write(key, value);
  };
  vi.stubGlobal("localStorage", local);
  vi.stubGlobal("sessionStorage", storage());
  expect(() => saveSession({ login: "tester", token: "token" })).toThrow("quota");
  expect(local.getItem("brick-stove-token")).toBeNull();
  expect(loadSession()).toBeNull();
});

it("allows logout even if both browser stores deny access", () => {
  const denied = {
    removeItem: () => {
      throw new Error("blocked");
    }
  };
  vi.stubGlobal("localStorage", denied);
  vi.stubGlobal("sessionStorage", denied);
  expect(() => clearSession()).not.toThrow();
});
