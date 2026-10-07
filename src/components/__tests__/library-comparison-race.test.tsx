import type { ReactElement, ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import type { LocalWorkspace } from "../../hooks/useLocalWorkspace";
import { LocalProjectsPanel } from "../LocalProjectsPanel";

const state = vi.hoisted(() => ({ setDiff: vi.fn(), index: 0 }));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: (initial: unknown) => [initial, state.index++ === 2 ? state.setDiff : vi.fn()],
  useRef: (current: unknown) => ({ current })
}));
vi.mock("../../domain/projectCompare", () => ({
  compareDocuments: () => ({ added: [], removed: [], moved: [], changed: [] })
}));
afterEach(() => {
  state.index = 0;
  state.setDiff.mockClear();
});
function buttons(node: ReactNode): ReactElement<{ "aria-label"?: string; onClick: () => Promise<void> }>[] {
  if (Array.isArray(node)) return node.flatMap(buttons);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as ReactElement<{ children?: ReactNode }>;
  return element.type === "button" ? [element as ReturnType<typeof buttons>[number]] : buttons(element.props.children);
}

it.each(["success", "error"])("ignores an older comparison's late %s after a newer selection", async (outcome) => {
  let resolveOld!: (value: unknown) => void;
  let rejectOld!: (error: Error) => void;
  const oldRead = new Promise((resolve, reject) => {
    resolveOld = resolve;
    rejectOld = reject;
  });
  const workspace = {
    projects: ["old", "new"].map((id) => ({ id, title: id, parentId: "active", kind: "project", updatedAt: 0 })),
    info: { id: "active" },
    ready: true,
    flush: vi.fn().mockResolvedValue({ snapshot: {} }),
    read: vi.fn((id: string) => (id === "old" ? oldRead : Promise.resolve({ snapshot: {} })))
  } as unknown as LocalWorkspace;
  const actions = buttons(LocalProjectsPanel({ workspace, onContinue: () => {} })).filter((button) =>
    button.props["aria-label"]?.startsWith("Сравнить:")
  );
  const older = actions[0].props.onClick();
  await actions[1].props.onClick();
  expect(state.setDiff).toHaveBeenCalledOnce();
  expect(state.setDiff.mock.calls[0][0]).toContain("«new»");
  if (outcome === "success") resolveOld({ snapshot: {} });
  else rejectOld(new Error("Old read failed"));
  await older;
  expect(state.setDiff).toHaveBeenCalledOnce();
});
