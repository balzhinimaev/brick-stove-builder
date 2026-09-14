import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PhysicsReview } from "../PhysicsReview";
import { PhysicsPanel } from "../PhysicsPanel";

const props = { bricks: [], grid: { cols: 16, rows: 20, widthCm: 200, lengthCm: 250 }, rowCount: 10 };
it("loads physics only on demand and clearly exposes scope and modelling assumptions", () => {
  const closed = renderToStaticMarkup(createElement(PhysicsReview, props));
  expect(closed).toContain("Опирание и гравитация");
  expect(closed).not.toContain("canvas");
  const panel = renderToStaticMarkup(createElement(PhysicsPanel, props));
  expect(panel).toContain("Парные швы без растяжения");
  expect(panel).toContain("10 · вся модель");
  expect(panel).toContain("Материалы и допущения расчёта");
  expect(panel).toContain("не полный статический расчёт");
  expect(panel).toContain("Блокировка ряда в редакторе не закрепляет");
});
