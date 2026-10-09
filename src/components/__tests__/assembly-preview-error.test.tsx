import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import AssemblyMovie from "../AssemblyMovie";

vi.mock("../ErrorBoundary", async (importOriginal) => {
  const { ErrorBoundary } = await importOriginal<typeof import("../ErrorBoundary")>();
  return {
    ErrorBoundary: class extends ErrorBoundary {
      // SSR cannot catch render errors; exercise the real failed state without WebGL.
      state = ErrorBoundary.getDerivedStateFromError();
    }
  };
});
vi.mock("@react-three/fiber", () => ({
  Canvas: () => {
    throw new Error("Failed preview must not render");
  }
}));

it("keeps the assembly dialog and exit available when its 3D preview fails", () => {
  const html = renderToStaticMarkup(
    <AssemblyMovie
      bricks={[{ id: "brick-1", kind: "standard", row: 1, x: 0, y: 0, orientation: "h" }]}
      grid={{ cols: 16, rows: 20, widthCm: 200, lengthCm: 250 }}
      rowCount={5}
      foundationHeight={1}
      onClose={() => {}}
      returnFocus={null}
    />
  );
  expect(html).toContain("<dialog");
  expect(html).toContain('<p role="alert">Не удалось показать 3D.');
  expect(html).toMatch(/<button type="button">Закрыть<\/button>/);
  expect(html).toContain('aria-label="Ряд сборки"');
  expect(html).toContain("▶ Воспроизвести");
});
