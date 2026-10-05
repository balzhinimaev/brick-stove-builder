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
