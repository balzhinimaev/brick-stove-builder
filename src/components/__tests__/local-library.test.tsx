import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { LocalWorkspace } from "../../hooks/useLocalWorkspace";
import { LocalProjectsPanel } from "../LocalProjectsPanel";

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
