import { expect, it, vi } from "vitest";
import { DEFAULT_PHYSICS } from "../physics/model";
import type { PhysicsCommand, PhysicsResponse } from "../physics/protocol";

it("runs, pauses, releases, resets and replaces the actual worker model without touching the document", async () => {
  const messages: PhysicsResponse[] = [];
  vi.stubGlobal("postMessage", (message: PhysicsResponse) => messages.push(message));
  vi.stubGlobal("onmessage", null);
  vi.stubGlobal("self", globalThis);
  const port = globalThis as unknown as { onmessage: ((event: MessageEvent<PhysicsCommand>) => void) | null };
  const waitFor = (check: () => void) =>
    vi.waitFor(
      () => {
        expect(messages.filter((m) => m.type === "error")).toEqual([]);
        check();
      },
      { timeout: 10000 }
    );
  const send = (command: PhysicsCommand) => port.onmessage?.({ data: command } as MessageEvent<PhysicsCommand>);
  try {
    await import("../../workers/physics.worker");
    const bricks = [{ id: "user-brick", row: 10, kind: "standard" as const, orientation: "h" as const, x: 1, y: 1 }];
    const original = JSON.stringify(bricks);
    const grid = { cols: 16, rows: 20, widthCm: 200, lengthCm: 250 };
    send({ type: "build", bricks, grid, settings: { ...DEFAULT_PHYSICS, heldIds: ["user-brick"] } });
    await waitFor(() => expect(messages.some((m) => m.type === "model")).toBe(true));
    send({ type: "step" });
    await waitFor(() => expect(messages.some((m) => m.type === "frame" && !m.running && m.frame.time > 0)).toBe(true));
    send({ type: "release" });
    send({ type: "run" });
    await waitFor(() =>
      expect(
        messages.some((m) => m.type === "frame" && m.running && m.frame.released && m.frame.maxDisplacementMm > 0)
      ).toBe(true)
    );
    send({ type: "pause" });
    await waitFor(() => expect(messages.at(-1)).toMatchObject({ type: "frame", running: false }));
    const length = messages.length;
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(messages).toHaveLength(length);
    send({ type: "reset" });
    await waitFor(() => expect(messages.at(-1)).toMatchObject({ type: "model" }));
    send({ type: "step" });
    await waitFor(() => expect(messages.at(-1)).toMatchObject({ type: "frame", frame: { released: false } }));
    const reset = messages.at(-1);
    if (reset?.type === "frame") expect(reset.frame.maxDisplacementMm).toBeLessThan(0.01);
    expect(JSON.stringify(bricks)).toBe(original);
    send({ type: "build", bricks: [], grid, settings: DEFAULT_PHYSICS });
    await waitFor(() => expect(messages.at(-1)).toMatchObject({ type: "model", model: { bodies: [] } }));
    expect(messages.filter((m) => m.type === "error")).toEqual([]);
  } finally {
    send({ type: "reset" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    vi.unstubAllGlobals();
  }
}, 15000);
