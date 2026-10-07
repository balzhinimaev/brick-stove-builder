import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { PhysicsPanel } from "../PhysicsPanel";

vi.mock("../ErrorBoundary", async (importOriginal) => {
  const { ErrorBoundary } = await importOriginal<typeof import("../ErrorBoundary")>();
  return {
    ErrorBoundary: class extends ErrorBoundary {
      // SSR cannot catch render errors; exercise the real boundary's failed state
      // without mounting a browser or creating a WebGL context.
      state = ErrorBoundary.getDerivedStateFromError();
    }
  };
});
vi.mock("../../hooks/usePhysics", () => ({
  usePhysics: () => ({
    model: {
      bodies: [{ id: "brick-1", name: "Кирпич", row: 1 }],
      bearings: [{ issues: ["disconnected"] }],
      totalMassKg: 3,
      foundationN: 0,
      unresolvedN: 30,
      heldN: 0,
      blockedJoints: [],
      overlapPairs: []
    },
    frame: null,
    running: true,
    status: "",
    error: "",
    send: vi.fn(),
    elapsedMs: 0
  })
}));

it("keeps pause, reset, report export and the parts list available after a 3D preview failure", () => {
  const html = renderToStaticMarkup(
    <PhysicsPanel bricks={[]} grid={{ cols: 16, rows: 20, widthCm: 200, lengthCm: 250 }} rowCount={5} />
  );
  expect(html).toContain('<p role="alert">Не удалось показать 3D.');
  expect(html).not.toContain("Загрузка 3D…");
  for (const label of ["Ⅱ Пауза", "↺ Сброс", "Отчёт JSON ↗"]) {
    const button = html.match(new RegExp(`<button[^>]*>${label}</button>`))?.[0];
    expect(button).toBeDefined();
    expect(button).not.toContain("disabled");
  }
  expect(html).toContain("Р1 · brick-1");
  expect(html).toContain("Нет связи с основанием");
  expect(html).toContain("Материалы и допущения расчёта");
});
