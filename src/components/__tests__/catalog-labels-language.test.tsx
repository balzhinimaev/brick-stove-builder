import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { LOCALES, translations } from "../../i18n";
import { ProjectsScreen } from "../ProjectsScreen";

const labels = {
  ru: { account: "В аккаунте", search: "Найти шаблон" },
  en: { account: "In your account", search: "Find a template" },
  lt: { account: "Paskyroje", search: "Rasti šabloną" }
};

it.each(LOCALES)("localizes the account heading and associated template search label (%s)", (locale) => {
  const html = renderToStaticMarkup(
    <ProjectsScreen
      locale={locale}
      t={(key) => translations[locale][key]}
      projects={[]}
      userLogin="owner"
      onLoad={() => {}}
      onPublish={async () => {}}
      onUnpublish={async () => {}}
      onDelete={async () => {}}
    />
  );
  expect(html).toMatch(new RegExp(`<h2[^>]*>${labels[locale].account}</h2>`));
  expect(html).toContain(`<label class="catalog-search">${labels[locale].search} <input type="search"`);
  if (locale !== "ru") {
    expect(html).not.toContain(labels.ru.account);
    expect(html).not.toContain(labels.ru.search);
  }
});
