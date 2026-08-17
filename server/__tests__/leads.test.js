import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db.js", () => ({ mongoReady: () => true }));
vi.mock("../models/Lead.js", async () => ({ Lead: (await import("./helpers/memoryModels.js")).Lead }));
vi.mock("../lib/telegram.js", () => ({ formatLeadMessage: () => "lead", notifyTelegram: vi.fn() }));

const { createApp } = await import("../app.js");
const { config } = await import("../config.js");
const { resetStores, stored } = await import("./helpers/memoryModels.js");
const { json, startTestServer } = await import("./helpers/http.js");
let server;
let ipSequence = 0;

beforeAll(async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  server = await startTestServer(createApp(config));
});
afterAll(() => server.close());
beforeEach(() => {
  resetStores();
  ipSequence += 1;
});
function submit(body, ip = `192.0.2.${ipSequence}`) {
  return server.request("/api/leads", { method: "POST", headers: { "x-forwarded-for": ip }, body });
}

describe("leads route", () => {
  it.each([{}, { phone: "123" }, { phone: "1".repeat(16) }])("requires a valid phone (%s)", async (body) => {
    expect((await submit(body)).status).toBe(400);
  });

  it("rejects an invalid email", async () => {
    expect((await submit({ phone: "+7 999 123-45-67", email: "broken" })).status).toBe(400);
  });

  it("enforces and stores every documented length limit", async () => {
    const long = "x".repeat(600);
    expect((await submit({ phone: "+7 999 123-45-67", name: long, email: "a@example.com", city: long, comment: long, source: long, utm: { source: long } })).status).toBe(201);
    expect(stored("leads")[0]).toMatchObject({ name: "x".repeat(100), city: "x".repeat(100), comment: "x".repeat(500), source: "x".repeat(100) });
    expect(stored("leads")[0].utm.source).toHaveLength(100);
  });

  it("rate limits the fourth request from one IP", async () => {
    const ip = `198.51.100.${ipSequence}`;
    for (let index = 0; index < 3; index += 1) expect((await submit({ phone: "+7 999 123-45-67" }, ip)).status).toBe(201);
    expect(await json(await submit({ phone: "+7 999 123-45-67" }, ip))).toMatchObject({ status: 429 });
  });
});
