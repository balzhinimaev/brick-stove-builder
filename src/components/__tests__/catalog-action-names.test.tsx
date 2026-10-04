import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { READY_PROJECTS } from "../../domain/projects";
import { LOCALES, translations } from "../../i18n";
import { ProjectsScreen } from "../ProjectsScreen";

it.each(LOCALES)("identifies catalog actions by localized project title (%s)", (locale) => {
  const projects = [false, true].map((published, index) => ({
    ...READY_PROJECTS[0],
    id: `owned-${index}`,
    title: { ru: `Печь ${index}`, en: `Stove ${index}`, lt: `Krosnis ${index}` },
    ownerLogin: "owner",
    showcase: { published, description: "", price: null, region: "" }
  }));
  const t = (key: keyof typeof translations.ru) => translations[locale][key];
  const html = renderToStaticMarkup(
    <ProjectsScreen
      locale={locale}
      t={t}
      projects={projects}
      userLogin="owner"
      onLoad={() => {}}
      onPublish={async () => {}}
      onUnpublish={async () => {}}
      onDelete={async () => {}}
    />
  );
  for (const project of projects) {
    const actions = [
      "loadProject",
      "deleteProject",
      project.showcase.published ? "unpublishAction" : "publishAction"
    ] as const;
    for (const action of actions) {
      expect(html).toContain(`aria-label="${t(action)}: ${project.title[locale]}"`);
      expect(html).toContain(`>${t(action)}</button>`);
    }
  }
});
