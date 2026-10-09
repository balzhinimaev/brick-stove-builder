import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { gridFromParameters } from "../../domain/geometry";
import { READY_PROJECTS } from "../../domain/projects";
import { useI18n } from "../../i18n";
import { ProjectOrderPreview } from "../ProjectsScreen";

const state = vi.hoisted(() => ({ expanded: false, page: 0 }));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useState: (initial: unknown) => react.useState(typeof initial === "boolean" ? state.expanded : state.page)
  };
});

afterEach(() => {
  state.expanded = false;
  state.page = 0;
});

it.each([false, true])("announces the row preview disclosure state: %s", (expanded) => {
  state.expanded = expanded;
  const project = READY_PROJECTS[0];
  const html = renderToStaticMarkup(
    <ProjectOrderPreview
      grid={gridFromParameters(project.parameters)}
      rows={{ 1: [] }}
      rowCount={1}
      t={useI18n("ru")}
    />
  );
  expect(html).toContain(`aria-expanded="${expanded}"`);
  expect(html).toContain(expanded ? "Свернуть ряды" : "Посмотреть порядовку");
  expect(html.includes("<svg")).toBe(expanded);
});

it.each([
  [36, 25, 30, false, false],
  [8, 7, 8, false, true],
  [6, 1, 6, true, true],
  [1, 1, 1, true, true]
])(
  "keeps a previously selected page usable after the project shrinks to %s rows",
  (rowCount, first, last, atStart, atEnd) => {
    state.expanded = true;
    state.page = 4;
    const project = READY_PROJECTS[0];
    const html = renderToStaticMarkup(
      <ProjectOrderPreview
        grid={gridFromParameters(project.parameters)}
        rows={{}}
        rowCount={rowCount}
        t={useI18n("ru")}
      />
    );
    expect(html).toContain(`<span>${first}–${last} / ${rowCount}</span>`);
    expect(html.match(/<svg\b/g)).toHaveLength(last - first + 1);
    expect(html).toContain(`<span>Ряд ${first}</span>`);
    expect(html).toContain(`<span>Ряд ${last}</span>`);
    const buttons = html.match(/<button\b[^>]*>.*?<\/button>/g) ?? [];
    expect(buttons.find((button) => button.includes("← Ряды"))?.includes('disabled=""')).toBe(atStart);
    expect(buttons.find((button) => button.includes("Ряды →"))?.includes('disabled=""')).toBe(atEnd);
  }
);

it.each([
  ["ru", "Посмотреть порядовку", "Свернуть ряды", "Ряды"],
  ["en", "View course layout", "Collapse rows", "Rows"],
  ["lt", "Peržiūrėti eilių planą", "Suskleisti eiles", "Eilės"]
] as const)("localizes collapsed and expanded preview controls in %s", (locale, show, hide, rowsLabel) => {
  const project = READY_PROJECTS[0];
  const render = () =>
    renderToStaticMarkup(
      <ProjectOrderPreview grid={gridFromParameters(project.parameters)} rows={{}} rowCount={8} t={useI18n(locale)} />
    );
  expect(render()).toContain(show);
  state.expanded = true;
  const html = render();
  const buttons = html.match(/<button\b[^>]*>.*?<\/button>/g) ?? [];
  expect(buttons).toHaveLength(3);
  expect(buttons[0]).toContain(hide);
  expect(buttons[1]).toContain(`← ${rowsLabel}`);
  expect(buttons[2]).toContain(`${rowsLabel} →`);
  expect(html).not.toContain(show);
});
