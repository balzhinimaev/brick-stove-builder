import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db.js", () => ({ mongoReady: () => true }));
vi.mock("../models/Project.js", async (importOriginal) => ({
  ...(await importOriginal()),
  Project: (await import("./helpers/memoryModels.js")).Project
}));

const { createApp } = await import("../app.js");
const { config } = await import("../config.js");
const { signToken } = await import("../lib/token.js");
const { resetStores } = await import("./helpers/memoryModels.js");
const { json, startTestServer } = await import("./helpers/http.js");

const tokens = {
  alice: signToken("alice", config.authSecret),
  bob: signToken("bob", config.authSecret)
};
const payload = {
  slug: "oven-one",
  title: { ru: "Печь" },
  parameters: { foundationWidth: 10, foundationLength: 12, foundationThickness: 2, roomHeight: 25 },
  rowCount: 3,
  rows: {}
};

let server;
beforeAll(async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  server = await startTestServer(createApp(config));
});
afterAll(() => server.close());
beforeEach(resetStores);

async function call(path, options) {
  return json(await server.request(path, options));
}

describe("projects routes", () => {
  it("creates, lists, reads, updates, publishes, unpublishes and deletes a project", async () => {
    expect(await call("/api/projects", { method: "POST", token: tokens.alice, body: payload })).toMatchObject({ status: 201, body: { project: { id: "oven-one" } } });
    expect((await call("/api/projects", { token: tokens.alice })).body.projects).toHaveLength(1);
    expect((await call("/api/projects/oven-one", { token: tokens.alice })).body.project.title.ru).toBe("Печь");

    const changed = await call("/api/projects/oven-one", { method: "PUT", token: tokens.alice, body: { ...payload, title: { ru: "Новая печь" } } });
    expect(changed.body.project.title.ru).toBe("Новая печь");
    const published = await call("/api/projects/oven-one/publish", { method: "POST", token: tokens.alice, body: { description: "Готово", price: 1234, region: "Москва" } });
    expect(published.body.project.showcase).toMatchObject({ published: true, description: "Готово", price: 1234 });
    expect((await call("/api/projects/oven-one/unpublish", { method: "POST", token: tokens.alice, body: {} })).body.project.showcase.published).toBe(false);
    expect(await call("/api/projects/oven-one", { method: "DELETE", token: tokens.alice })).toMatchObject({ status: 200, body: { ok: true, id: "oven-one" } });
    expect((await call("/api/projects", { token: tokens.alice })).body.projects).toEqual([]);
  });

  it.each([
    ["read", "GET", "/api/projects/oven-one", undefined],
    ["update", "PUT", "/api/projects/oven-one", payload],
    ["publish", "POST", "/api/projects/oven-one/publish", {}],
    ["unpublish", "POST", "/api/projects/oven-one/unpublish", {}],
    ["delete", "DELETE", "/api/projects/oven-one", undefined]
  ])("does not let another user %s a project", async (_name, method, path, body) => {
    await call("/api/projects", { method: "POST", token: tokens.alice, body: payload });
    expect(await call(path, { method, token: tokens.bob, body })).toMatchObject({ status: 404, body: { error: "Project not found" } });
  });

  it("treats an offline retry with the same owner and slug as idempotent", async () => {
    const first = await call("/api/projects", { method: "POST", token: tokens.alice, body: payload });
    const retry = await call("/api/projects", { method: "POST", token: tokens.alice, body: payload });
    expect(first.status).toBe(201);
    expect(retry).toMatchObject({ status: 200, body: { project: { id: "oven-one", ownerLogin: "alice" } } });
  });

  it("rejects a duplicate global slug owned by somebody else", async () => {
    await call("/api/projects", { method: "POST", token: tokens.alice, body: payload });
    expect(await call("/api/projects", { method: "POST", token: tokens.bob, body: payload })).toMatchObject({ status: 409 });
  });

  it("requires authentication", async () => {
    expect(await call("/api/projects")).toMatchObject({ status: 401 });
  });
});
