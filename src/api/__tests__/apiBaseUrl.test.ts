import { afterEach, describe, expect, it, vi } from "vitest";
import { apiBaseUrl } from "../client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("API deployment path", () => {
  it.each([
    ["/", "/api"],
    ["/projects", "/api"],
    ["/brick-stove-builder", "/brick-stove-builder/api"],
    ["/brick-stove-builder/", "/brick-stove-builder/api"],
    ["/brick-stove-builder/projects", "/brick-stove-builder/api"],
    ["/brick-stove-builder-preview", "/api"],
    ["/brick-stove-builder2/projects", "/api"]
  ])("resolves %s to %s", (pathname, expected) => {
    vi.stubEnv("VITE_API_BASE", "");
    vi.stubGlobal("window", { location: { pathname } });
    expect(apiBaseUrl()).toBe(expected);
  });

  it("keeps an explicit API base authoritative", () => {
    vi.stubEnv("VITE_API_BASE", "https://example.test/custom-api/");
    vi.stubGlobal("window", { location: { pathname: "/brick-stove-builder/projects" } });
    expect(apiBaseUrl()).toBe("https://example.test/custom-api");
  });
});
