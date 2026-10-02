import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { gridFromParameters } from "../../domain/geometry";
import { READY_PROJECTS } from "../../domain/projects";
import { ProjectOrderPreview } from "../ProjectsScreen";

const state = vi.hoisted(() => ({ expanded: false }));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useState: (initial: unknown) => react.useState(typeof initial === "boolean" ? state.expanded : initial)
  };
});

it.each([false, true])("announces the row preview disclosure state: %s", (expanded) => {
  state.expanded = expanded;
  const project = READY_PROJECTS[0];
  const html = renderToStaticMarkup(
    <ProjectOrderPreview grid={gridFromParameters(project.parameters)} rows={{ 1: [] }} rowCount={1} t={(key) => key} />
  );
  expect(html).toContain(`aria-expanded="${expanded}"`);
  expect(html).toContain(expanded ? "Свернуть ряды" : "Посмотреть порядовку");
  expect(html.includes("<svg")).toBe(expanded);
});
