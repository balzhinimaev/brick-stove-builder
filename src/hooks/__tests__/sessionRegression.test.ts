import { afterEach, expect, it, vi } from "vitest";
import { useSession } from "../useSession";
import { login } from "../../api/client";
import type { Translate } from "../../i18n";
vi.mock("react", () => ({
  useEffect: vi.fn(),
  useRef: (current: unknown) => ({ current }),
  useState: vi.fn()
}));
vi.mock("../../api/client", () => ({
  clearSession: vi.fn(),
  loadSession: vi.fn(),
  saveSession: vi.fn(),
  normalizeLogin: (value: string) => value,
  login: vi.fn(),
  register: vi.fn()
}));
import { useState } from "react";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});
it("handles rejected fetch, suppresses duplicate submit, and allows retry", async () => {
  const states = [null, "login", "tester", "test-password"];
  vi.mocked(useState).mockImplementation(() => [states.shift(), vi.fn()] as never);
  vi.stubGlobal("window", { alert: vi.fn() });
  let reject!: (error: Error) => void;
  vi.mocked(login).mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      })
  );
  vi.mocked(login).mockResolvedValue({ ok: false, status: 503 });
  const hook = useSession(((key: string) => key) as Translate);
  const first = hook.submitAuth();
  await hook.submitAuth();
  expect(login).toHaveBeenCalledTimes(1);
  reject(new TypeError("network unavailable"));
  await expect(first).resolves.toBeUndefined();
  expect(window.alert).toHaveBeenLastCalledWith("authUnavailable");
  await hook.submitAuth();
  expect(login).toHaveBeenCalledTimes(2);
  expect(window.alert).toHaveBeenLastCalledWith("authUnavailable");
});
