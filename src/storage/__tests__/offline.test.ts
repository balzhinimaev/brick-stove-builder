import { describe, expect, it } from "vitest";
import { flushOps, type FlushExecutor, type PendingOp } from "../offline";
import type { ReadyProject } from "../../domain/types";

const project = (id: string): ReadyProject => ({
  id,
  title: { ru: id, en: id, lt: id },
  subtitle: { ru: "", en: "", lt: "" },
  parameters: { foundationWidth: 120, foundationLength: 160, foundationThickness: 25, roomHeight: 260 },
  rowCount: 1,
  lockedRows: [],
  rows: {},
  accent: "#C1440E"
});

const createOp = (id: string): PendingOp => ({ kind: "create", project: project(id), queuedAt: 1 });
const updateOp = (id: string, marker = ""): PendingOp => ({ kind: "update", id, project: { ...project(id), accent: marker || "#C1440E" }, queuedAt: 1 });
const deleteOp = (id: string): PendingOp => ({ kind: "delete", id, queuedAt: 1 });

class Permanent extends Error {}
class Auth extends Error {}

/** Executor-фейк: сценарий задаётся списком ответов на каждый вызов. */
function fakeExec(script: Record<string, Array<"ok" | "net" | "permanent" | "auth">>) {
  const calls: string[] = [];
  const next = (key: string) => {
    const plan = script[key] ?? [];
    const verdict = plan.shift() ?? "ok";
    calls.push(key);
    if (verdict === "net") throw new Error("network");
    if (verdict === "permanent") throw new Permanent();
    if (verdict === "auth") throw new Auth();
  };
  const exec: FlushExecutor = {
    create: async (p) => {
      next(`create:${p.id}`);
      return { ...p, id: `srv-${p.id}` };
    },
    update: async (id, p) => {
      next(`update:${id}`);
      return { ...p, id };
    },
    remove: async (id) => {
      next(`delete:${id}`);
    },
    isPermanent: (e) => e instanceof Permanent,
    isAuth: (e) => e instanceof Auth
  };
  return { exec, calls };
}

describe("flushOps", () => {
  it("выполняет операции по порядку и опустошает очередь", async () => {
    const { exec, calls } = fakeExec({});
    const result = await flushOps([createOp("a"), updateOp("b"), deleteOp("c")], exec);
    expect(result.remaining).toHaveLength(0);
    expect(result.authFailed).toBe(false);
    expect(calls).toEqual(["create:a", "update:b", "delete:c"]);
  });

  it("транзиентная ошибка сохраняет упавшую операцию И весь хвост (порядок не ломается)", async () => {
    // офлайн-сценарий из ревью: [update v1, update v2] — если v1 упал, v2
    // НЕ должен выполниться, иначе следующий flush перегонит v1 поверх v2
    const { exec, calls } = fakeExec({ "update:p": ["net"] });
    const ops = [updateOp("p", "#v1"), updateOp("p", "#v2")];
    const result = await flushOps(ops, exec);
    expect(result.remaining).toEqual(ops);
    expect(calls).toEqual(["update:p"]);
  });

  it("постоянная ошибка (404) выбрасывает только отравленную операцию", async () => {
    // удалили проект с другого устройства: delete 404 не должен вечно блокировать очередь
    const { exec, calls } = fakeExec({ "delete:gone": ["permanent"] });
    const result = await flushOps([deleteOp("gone"), createOp("a")], exec);
    expect(result.remaining).toHaveLength(0);
    expect(calls).toEqual(["delete:gone", "create:a"]);
  });

  it("401 останавливает прокачку целиком до перелогина", async () => {
    const { exec, calls } = fakeExec({ "create:a": ["auth"] });
    const ops = [createOp("a"), updateOp("b")];
    const result = await flushOps(ops, exec);
    expect(result.authFailed).toBe(true);
    expect(result.remaining).toEqual(ops);
    expect(calls).toEqual(["create:a"]);
  });

  it("update/delete офлайн-созданного проекта идут по серверному id из idMap", async () => {
    const { exec, calls } = fakeExec({});
    const result = await flushOps([createOp("tmp"), updateOp("tmp"), deleteOp("tmp")], exec);
    expect(result.idMap).toEqual({ tmp: "srv-tmp" });
    expect(calls).toEqual(["create:tmp", "update:srv-tmp", "delete:srv-tmp"]);
  });
});
