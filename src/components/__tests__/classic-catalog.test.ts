import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ShowcaseScreen } from "../ShowcaseScreen";
import { ProjectsScreen } from "../ProjectsScreen";
import { BUILTIN_SHOWCASE_PROJECTS } from "../../domain/showcaseProjects";
import { READY_PROJECTS } from "../../domain/projects";
import { translations, type Translate } from "../../i18n";
import { initialEditorState } from "../../domain/editor/state";
import { editorReducer } from "../../domain/editor/reducer";
const t: Translate = (key) => translations.ru[key];
const load = () => {};
describe("separate guest examples", () => {
  it("renders every bundled card with load buttons and without a commercial lead form", () => {
    const html = renderToStaticMarkup(createElement(ShowcaseScreen, { locale: "ru", t, onLoad: load }));
    for (const p of BUILTIN_SHOWCASE_PROJECTS) expect(html).toContain(`id="${p.id}"`);
    expect(html.split(t("loadProject")).length - 1).toBe(BUILTIN_SHOWCASE_PROJECTS.length);
    expect(html).not.toContain(t("showcaseWant"));
  });
  it("keeps unique IDs in the guest catalog and loads distinct rows through the ordinary editor", () => {
    expect(BUILTIN_SHOWCASE_PROJECTS.map((p) => p.id)).toEqual([
      "russian-stove-hob",
      "classic-russian-stove-hob",
      "shkolnik-pov-3500"
    ]);
    const html = renderToStaticMarkup(
      createElement(ProjectsScreen, {
        locale: "ru",
        t,
        projects: READY_PROJECTS,
        onLoad: load,
        userLogin: null,
        onPublish: async () => {},
        onUnpublish: async () => {},
        onDelete: async () => {}
      })
    );
    for (const p of BUILTIN_SHOWCASE_PROJECTS) {
      expect(READY_PROJECTS.filter((q) => q.id === p.id)).toHaveLength(1);
      expect(html).toContain(p.title.ru);
      const state = editorReducer(initialEditorState(), { type: "loadProject", project: p });
      expect(state.rows).toEqual(p.rows);
      expect(state.rowCount).toBe(p.rowCount);
    }
  });
});
