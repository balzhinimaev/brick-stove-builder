import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { LocalWorkspace } from "../../hooks/useLocalWorkspace";
import { ProjectBar } from "../ProjectBar";

it.each([
  [false, false],
  [false, true],
  [true, true],
  [true, false]
])("gates project mutations on readiness and availability (ready=%s, busy=%s)", (ready, busy) => {
  const workspace = { ready, busy, state: "loading", error: "" } as LocalWorkspace;
  const html = renderToStaticMarkup(<ProjectBar workspace={workspace} />);
  const buttons = html.match(/<button\b[^>]*>.*?<\/button>/g) ?? [];
  for (const label of ["Переименовать", "Сохранить копию…", "Контрольная точка…"]) {
    const button = buttons.find((entry) => entry.includes(label));
    expect(button).toBeDefined();
    expect(button?.includes('disabled=""')).toBe(!ready || busy);
  }
  // Export stays available even when local persistence is unavailable.
  expect(buttons.find((entry) => entry.includes("Скачать полный проект"))).not.toContain('disabled=""');
});

it.each([undefined, "Печь для кухни", "Копия 2"])(
  "exposes the rename action and current project title to assistive technology (%s)",
  (title) => {
    const workspace = {
      ready: true,
      busy: false,
      state: "saved",
      error: "",
      info: title ? { title, revision: 1, updatedAt: 0 } : null
    } as LocalWorkspace;
    const html = renderToStaticMarkup(<ProjectBar workspace={workspace} />);
    const button = html.match(/<button\b[^>]*class="project-title"[^>]*>.*?<\/button>/)?.[0];
    expect(button).toContain(`aria-label="Переименовать: ${title ?? "Новая печь"}"`);
    expect(button).toContain(`${title ?? "Новая печь"} <span aria-hidden="true">`);
  }
);
