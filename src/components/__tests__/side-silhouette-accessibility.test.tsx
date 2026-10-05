import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { READY_PROJECTS } from "../../domain/projects";
import { LOCALES, translations } from "../../i18n";
import { SideSilhouette } from "../SideSilhouette";

it.each(LOCALES)("names the side preview in the selected interface language: %s", (locale) => {
  const html = renderToStaticMarkup(
    <SideSilhouette parameters={READY_PROJECTS[0].parameters} lockedRows={[]} t={(key) => translations[locale][key]} />
  );
  expect(html).toContain(`<title>${translations[locale].liveSidePreview}</title>`);
  expect(html).toContain(translations[locale].ceilingLimit);
});
