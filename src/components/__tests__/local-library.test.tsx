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
    ready: true,
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
    ready: true,
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

it.each([false, true])("announces library loading before empty or search results (versions: %s)", (versions) => {
  filters.versions = versions;
  const workspace = { projects: [], ready: false, busy: false, error: "" } as unknown as LocalWorkspace;
  const render = () => {
    filters.stateIndex = 0;
    return renderToStaticMarkup(<LocalProjectsPanel workspace={workspace} onContinue={() => {}} />);
  };
  for (const query of ["", "Печь"]) {
    filters.query = query;
    const html = render();
    expect(html).toContain('<output aria-live="polite">Открываю локальную библиотеку…</output>');
    expect(html).not.toContain("Пока нет");
    expect(html).not.toContain("ничего не найдено");
  }
  workspace.ready = true;
  expect(render()).not.toContain("Открываю локальную библиотеку…");
  expect(render()).toContain("По вашему запросу ничего не найдено.");
});

it.each([false, true])(
  "ignores surrounding search whitespace without removing spaces inside titles (versions: %s)",
  (versions) => {
    filters.versions = versions;
    const workspace = {
      projects: [
        { id: "one", title: "Печь в доме", kind: versions ? "checkpoint" : "project", revision: 1, updatedAt: 0 }
      ],
      ready: true,
      busy: false,
      error: ""
    } as LocalWorkspace;
    const render = () => {
      filters.stateIndex = 0;
      return renderToStaticMarkup(<LocalProjectsPanel workspace={workspace} onContinue={() => {}} />);
    };
    filters.query = "  ПЕЧЬ В ДОМЕ\t";
    expect(render()).toContain(`aria-label="${versions ? "Восстановить копию" : "Открыть"}: Печь в доме"`);
    expect(render()).toContain("Найдено: 1.");
    filters.query = "Печьвдоме";
    expect(render()).toContain("По вашему запросу ничего не найдено.");
    filters.query = " \t ";
    expect(render()).toContain("Печь в доме");
    expect(render()).not.toContain("Найдено:");
    workspace.projects = [];
    expect(render()).toContain(`Пока нет ${versions ? "контрольных точек" : "проектов"}.`);
    expect(render()).not.toContain("По вашему запросу");
  }
);
