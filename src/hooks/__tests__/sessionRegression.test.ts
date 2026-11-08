import { afterEach, expect, it, vi } from "vitest";
import { useSession } from "../useSession";
import { login, saveSession } from "../../api/client";
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
import { useEffect, useState } from "react";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});
it("handles rejected fetch, suppresses duplicate submit, and allows retry", async () => {
  const states = [null, "login", "tester", "test-password", true, false, null];
  const update = vi.fn();
  vi.mocked(useState).mockImplementation(() => [states.shift(), update] as never);
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
  expect(update).toHaveBeenCalledWith("authUnavailable");
  await hook.submitAuth();
  expect(login).toHaveBeenCalledTimes(2);
  expect(update).toHaveBeenCalledWith("authUnavailable");
});

it.each(["unmount", "switch"])("ignores a successful login after %s", async (action) => {
  const states = [null, "login", "tester", "test-password", true, false, null];
  const update = vi.fn();
  vi.mocked(useState).mockImplementation(() => [states.shift(), update] as never);
  vi.stubGlobal("window", { alert: vi.fn() });
  let resolve!: (result: Awaited<ReturnType<typeof login>>) => void;
  vi.mocked(login).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const hook = useSession(((key: string) => key) as Translate);
  const cleanup = vi.mocked(useEffect).mock.calls[0][0]();
  const pending = hook.submitAuth();
  if (action === "unmount") {
    if (typeof cleanup === "function") cleanup();
  } else hook.switchAccount();
  update.mockClear();
  resolve({ ok: true, session: { login: "tester", token: "old-token" } });
  await pending;
  expect(saveSession).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
  expect(window.alert).not.toHaveBeenCalled();
});

it("a cancelled request cannot unlock or report errors over a newer login", async () => {
  const states = [null, "login", "tester", "test-password", true, false, null];
  const update = vi.fn();
  vi.mocked(useState).mockImplementation(() => [states.shift(), update] as never);
  vi.stubGlobal("window", { alert: vi.fn() });
  let reject!: (error: Error) => void;
  let resolve!: (result: Awaited<ReturnType<typeof login>>) => void;
  vi.mocked(login)
    .mockImplementationOnce(
      () =>
        new Promise((_done, fail) => {
          reject = fail;
        })
    )
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
  const hook = useSession(((key: string) => key) as Translate);
  const first = hook.submitAuth();
  hook.switchAccount();
  const second = hook.submitAuth();
  reject(new Error("late failure"));
  await first;
  await hook.submitAuth();
  expect(login).toHaveBeenCalledTimes(2);
  expect(window.alert).not.toHaveBeenCalled();
  const session = { login: "tester", token: "new-token" };
  resolve({ ok: true, session });
  await second;
  expect(saveSession).toHaveBeenCalledExactlyOnceWith(session, true);
});
