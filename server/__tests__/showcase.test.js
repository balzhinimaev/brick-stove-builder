import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db.js", () => ({ mongoReady: () => true }));
vi.mock("../models/Project.js", async (importOriginal) => ({
  ...(await importOriginal()),
  Project: (await import("./helpers/memoryModels.js")).Project
}));

const { createApp } = await import("../app.js");
const { config } = await import("../config.js");
const { Project } = await import("./helpers/memoryModels.js");
const { resetStores } = await import("./helpers/memoryModels.js");
const { json, startTestServer } = await import("./helpers/http.js");
const base = { title: { ru: "Печь" }, parameters: {}, rowCount: 1, ownerLogin: "alice" };
let server;

beforeAll(async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  server = await startTestServer(createApp(config));
});
afterAll(() => server.close());
beforeEach(resetStores);

describe("showcase routes", () => {
  it("lists and reads only published projects", async () => {
    await Project.create({ ...base, slug: "public", showcase: { published: true, publishedAt: new Date() } });
    await Project.create({ ...base, slug: "private", showcase: { published: false } });
    expect((await json(await server.request("/api/showcase"))).body.projects.map((item) => item.id)).toEqual(["public"]);
    expect((await server.request("/api/showcase/public")).status).toBe(200);
    expect((await server.request("/api/showcase/private")).status).toBe(404);
  });
});
