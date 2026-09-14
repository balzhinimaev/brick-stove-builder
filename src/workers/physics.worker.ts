import { buildPhysicsModel, type PhysicsModel } from "../domain/physics/model";
import type { PhysicsCommand, PhysicsResponse } from "../domain/physics/protocol";
import type { GravitySimulation } from "../domain/physics/simulation";

let model: PhysicsModel | null = null;
let simulation: GravitySimulation | null = null;
let running = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const reply = (value: PhysicsResponse) => self.postMessage(value);
const stop = () => {
  running = false;
  clearTimeout(timer);
};
const fail = (error: unknown) => {
  stop();
  reply({ type: "error", message: error instanceof Error ? error.message : "Не удалось выполнить расчёт" });
};
function publish() {
  if (simulation) reply({ type: "frame", frame: simulation.frame(true), running });
}
function tick() {
  if (!running || !simulation) return;
  try {
    const start = performance.now();
    // Bounded work batches keep pause/reset responsive, even on a large model.
    let steps = 0;
    do {
      simulation.step();
      steps++;
    } while (steps < 6 && performance.now() - start < 30);
    if (simulation.frame().time >= 10) stop();
    publish();
    if (running) timer = setTimeout(tick, Math.max(0, 50 - (performance.now() - start)));
  } catch (error) {
    fail(error);
  }
}
let commands: Promise<void> = Promise.resolve();
self.onmessage = (event: MessageEvent<PhysicsCommand>) => {
  const command = event.data;
  commands = commands
    .then(async () => {
      if (command.type === "build") {
        stop();
        simulation?.free();
        simulation = null;
        model = null;
        reply({ type: "status", text: "Ищу контакты и пути передачи веса…" });
        model = buildPhysicsModel(command.bricks, command.grid, command.settings);
        reply({ type: "model", model });
        return;
      }
      if (!model) return;
      if (command.type === "reset") {
        stop();
        simulation?.free();
        simulation = null;
        reply({ type: "model", model });
        return;
      }
      if (command.type === "pause") {
        stop();
        publish();
        return;
      }
      if (!simulation) {
        reply({ type: "status", text: "Подготавливаю физические тела и швы…" });
        const { initPhysics, GravitySimulation } = await import("../domain/physics/simulation");
        await initPhysics();
        simulation = new GravitySimulation(model);
      }
      if (command.type === "release") {
        simulation.releaseHeld();
        publish();
        return;
      }
      if (command.type === "step") {
        stop();
        simulation.step();
        publish();
        return;
      }
      if (!running) {
        running = true;
        tick();
      }
    })
    .catch(fail);
};
