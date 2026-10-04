import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import type { LocalWorkspace } from "../../hooks/useLocalWorkspace";
import { LocalProjectsPanel } from "../LocalProjectsPanel";

const filters = vi.hoisted(() => ({ query: "", versions: false, stateIndex: 0 }));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useState: (initial: unknown) => {
      const [value, setValue] = react.useState(initial);
      const index = filters.stateIndex++;
      return [index === 0 ? filters.query : index === 1 ? filters.versions : value, setValue];
    }
  };
});
afterEach(() => {
  filters.query = "";
  filters.versions = false;
  filters.stateIndex = 0;
});

it("identifies each project in library action names without changing visible button text", () => {
  const projects = ["Печь в доме", "Печь в бане"].map((title, index) => ({
    id: String(index),
    title,
    namespace: "guest",
    revision: 1,
    updatedAt: 0,
    kind: "project" as const,
    parentId: "active"
  }));
  const workspace = {
    projects,
    info: { id: "active", title: "Текущая работа" },
    busy: false,
    error: ""
  } as LocalWorkspace;
  const html = renderToStaticMarkup(<LocalProjectsPanel workspace={workspace} onContinue={() => {}} />);
  for (const { title } of projects) {
    expect(html).toContain(`aria-label="Открыть: ${title}"`);
    expect(html).toContain(`aria-label="Сравнить: ${title}"`);
  }
  expect(html.match(/>Открыть<\/button>/g)).toHaveLength(2);
  expect(html.match(/>Сравнить<\/button>/g)).toHaveLength(2);
});

it.each([false, true])("distinguishes empty search results from an empty library (versions: %s)", (versions) => {
  filters.versions = versions;
  const workspace = {
    projects: [
      { id: "one", title: "Печь в доме", kind: versions ? "checkpoint" : "project", revision: 1, updatedAt: 0 }
    ],
    busy: false,
    error: ""
  } as LocalWorkspace;
  const render = () => {
    filters.stateIndex = 0;
    return renderToStaticMarkup(<LocalProjectsPanel workspace={workspace} onContinue={() => {}} />);
  };
  filters.query = "бане";
  expect(render()).toContain(
    '<output aria-live="polite">По вашему запросу ничего не найдено. Попробуйте другое название.</output>'
  );
  expect(render()).not.toContain("Пока нет");
  filters.query = "ДОМЕ";
  expect(render()).toContain('<output aria-live="polite">Найдено: 1.</output>');
  filters.query = "";
  workspace.projects = [];
  expect(render()).toContain(
    `<output aria-live="polite">Пока нет ${versions ? "контрольных точек" : "проектов"}.</output>`
  );
});
