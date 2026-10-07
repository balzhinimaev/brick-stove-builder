import type { ReactElement, ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { submitLead } from "../../api/client";
import { READY_PROJECTS } from "../../domain/projects";
import { translations } from "../../i18n";
import { LeadForm } from "../ShowcaseScreen";

const state = vi.hoisted(() => ({ values: [] as unknown[], index: 0, setStatus: vi.fn() }));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: () => [state.values[state.index++], state.setStatus]
}));
vi.mock("../../api/client", () => ({ submitLead: vi.fn().mockResolvedValue(true) }));
afterEach(() => {
  vi.clearAllMocks();
  state.index = 0;
});

function buttons(node: ReactNode): ReactElement<{ type: string; disabled?: boolean }>[] {
  if (Array.isArray(node)) return node.flatMap(buttons);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as ReactElement<{ children?: ReactNode }>;
  return element.type === "button" ? [element as ReturnType<typeof buttons>[number]] : buttons(element.props.children);
}

it.each(["idle", "error", "sending"])(
  "handles native form submission while %s without navigating away",
  async (status) => {
    state.values = [true, "Owner", "+7 999 123 45 67", status];
    const project = READY_PROJECTS[0];
    const form = LeadForm({ project, locale: "ru", t: (key) => translations.ru[key] });
    expect(form.type).toBe("form");
    const actions = buttons(form);
    expect(actions.filter((button) => button.props.type === "submit")).toHaveLength(1);
    expect(actions[0].props.disabled).toBe(status === "sending");
    expect(actions[1].props.type).toBe("button");
    const preventDefault = vi.fn();
    form.props.onSubmit({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    if (status === "sending") {
      expect(submitLead).not.toHaveBeenCalled();
      return;
    }
    expect(submitLead).toHaveBeenCalledExactlyOnceWith({
      name: "Owner",
      phone: "+7 999 123 45 67",
      comment: `${translations.ru.showcaseWant}: «${project.title.ru}»`,
      source: `showcase:${project.id}`
    });
    await vi.waitFor(() => expect(state.setStatus).toHaveBeenLastCalledWith("done"));
  }
);
