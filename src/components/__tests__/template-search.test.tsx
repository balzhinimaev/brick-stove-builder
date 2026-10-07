import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { READY_PROJECTS } from "../../domain/projects";
import { LOCALES, translations } from "../../i18n";
import { ProjectsScreen } from "../ProjectsScreen";

const search = vi.hoisted(() => ({ query: "", stateIndex: 0 }));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useState: (initial: unknown) => {
      const [value, setValue] = react.useState(initial);
      return [search.stateIndex++ === 0 ? search.query : value, setValue];
    }
  };
});

it.each(LOCALES)("normalizes pasted template searches without changing title spacing (%s)", (locale) => {
  const titles = { ru: "Печь в доме", en: "House stove", lt: "Namo krosnis" };
  const template = { ...READY_PROJECTS[0], id: "template", title: titles, ownerLogin: undefined };
  const owned = { ...template, id: "owned", ownerLogin: "owner", title: { ru: "Моя", en: "Mine", lt: "Mano" } };
  const t = (key: keyof typeof translations.ru) => translations[locale][key];
  const render = (query: string) => {
    search.query = query;
    search.stateIndex = 0;
    return renderToStaticMarkup(
      <ProjectsScreen
        locale={locale}
        t={t}
        projects={[template, owned]}
        userLogin="owner"
        onLoad={() => {}}
        onPublish={async () => {}}
        onUnpublish={async () => {}}
        onDelete={async () => {}}
      />
    );
  };
  const templateAction = `aria-label="${t("loadProject")}: ${titles[locale]}"`;
  for (const query of [`  ${titles[locale].toUpperCase()}\t`, " \t ", ""]) {
    expect(render(query)).toContain(templateAction);
  }
  const unmatched = render(titles[locale].replaceAll(" ", ""));
  expect(unmatched).not.toContain(templateAction);
  expect(unmatched).toContain(`aria-label="${t("loadProject")}: ${owned.title[locale]}"`);
});
