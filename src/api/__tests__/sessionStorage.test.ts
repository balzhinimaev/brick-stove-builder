import { afterEach, expect, it, vi } from "vitest";
import { loadSession } from "../client";

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
