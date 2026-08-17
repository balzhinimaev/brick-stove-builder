import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db.js", () => ({ mongoReady: () => true }));
vi.mock("../models/Draft.js", async () => ({ Draft: (await import("./helpers/memoryModels.js")).Draft }));

const { createApp } = await import("../app.js");
const { config } = await import("../config.js");
const { signToken } = await import("../lib/token.js");
const { resetStores } = await import("./helpers/memoryModels.js");
const { json, startTestServer } = await import("./helpers/http.js");
const token = signToken("alice", config.authSecret);
const validDraft = { parameters: { foundationWidth: 10, foundationLength: 10, foundationThickness: 2, roomHeight: 20 }, rowCount: 2, currentRow: 1, lockedRows: [1], rows: {}, updatedAt: 100 };
let server;

beforeAll(async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  server = await startTestServer(createApp(config));
});
afterAll(() => server.close());
beforeEach(resetStores);

describe("draft routes", () => {
  it("saves and restores a user's draft", async () => {
    const saved = await json(await server.request("/api/draft", { method: "PUT", token, body: validDraft }));
    expect(saved).toMatchObject({ status: 200, body: { ok: true, draft: { rowCount: 2, updatedAt: 100 } } });
    expect(await json(await server.request("/api/draft", { token }))).toMatchObject({ status: 200, body: { draft: { lockedRows: [1], currentRow: 1 } } });
  });

  it.each(["GET", "PUT"])("requires authorization for %s", async (method) => {
    expect((await server.request("/api/draft", { method, body: method === "PUT" ? validDraft : undefined })).status).toBe(401);
  });

  it.each([
    [{ ...validDraft, parameters: undefined }, "parameters"],
    [{ ...validDraft, rowCount: 0 }, "row count"],
    [{ ...validDraft, currentRow: 0 }, "current row"]
  ])("rejects an invalid body (%s)", async (body) => {
    expect((await server.request("/api/draft", { method: "PUT", token, body })).status).toBe(400);
  });
});
