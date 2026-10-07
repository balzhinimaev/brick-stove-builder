import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("preserves the native UUID identifier on secure origins", async () => {
  vi.stubGlobal("crypto", { randomUUID: () => "native-uuid" });
  const { uniqueId } = await import("../id");
  expect(uniqueId("local")).toBe("local-native-uuid");
});

it("does not repeat persisted IDs across HTTP sessions with identical timers", async () => {
  vi.stubGlobal("performance", { now: () => 100 });
  let entropy = 0;
  vi.stubGlobal("crypto", {
    getRandomValues: (bytes: Uint8Array) => bytes.fill(++entropy)
  });
  const firstSession = await import("../id");
  const first = firstSession.uniqueId("local");
  vi.resetModules();
  const secondSession = await import("../id");
  const second = secondSession.uniqueId("local");
  expect(first).toMatch(/^local-[0-9a-f]{32}$/);
  expect(second).toMatch(/^local-[0-9a-f]{32}$/);
  expect(second).not.toBe(first);
});

it("still generates distinct IDs within a session without Web Crypto", async () => {
  vi.stubGlobal("crypto", undefined);
  vi.stubGlobal("performance", { now: () => 100 });
  const { uniqueId } = await import("../id");
  expect(uniqueId("local")).not.toBe(uniqueId("local"));
});
