import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { PhysicsPanel } from "../PhysicsPanel";

const state = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0, count: 120 }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = state.cursor++;
    if (!(index in state.values)) state.values[index] = typeof initial === "function" ? initial() : initial;
    return [
      state.values[index],
      (value: unknown) => {
        state.values[index] = typeof value === "function" ? value(state.values[index]) : value;
      }
    ];
  },
  useMemo: (compute: () => unknown) => compute(),
  useRef: (current: unknown) => ({ current }),
  useEffect: vi.fn()
}));
vi.mock("../../hooks/usePhysics", () => ({
  usePhysics: () => ({
    model: {
      bodies: Array.from({ length: state.count }, (_, i) => ({ id: `brick-${i}`, name: "Кирпич", row: 1 })),
      bearings: Array.from({ length: state.count }, () => ({ issues: ["disconnected"] })),
      totalMassKg: 0,
      foundationN: 0,
      unresolvedN: 0,
      heldN: 0,
      blockedJoints: [],
      overlapPairs: []
    },
    frame: null,
    running: false,
    status: "",
    error: null,
    send: vi.fn(),
    elapsedMs: 0
  })
}));

type Props = {
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  onChange?: (event: { target: { value: string } }) => void;
};
function find(node: ReactNode, predicate: (element: ReactElement<Props>) => boolean): ReactElement<Props>[] {
  const found: ReactElement<Props>[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement<Props>(child)) return;
    if (predicate(child)) found.push(child);
    found.push(...find(child.props.children, predicate));
  });
  return found;
}
function render() {
  state.cursor = 0;
  const tree = PhysicsPanel({ bricks: [], grid: { cols: 16, rows: 20, widthCm: 200, lengthCm: 250 }, rowCount: 5 });
  const parts = find(tree, (node) => node.props.className === "physics-parts")[0];
  const button = (label: string) => find(tree, (node) => node.type === "button" && node.props.children === label)[0];
  return {
    search: find(tree, (node) => node.type === "input" && !!node.props.onChange).at(-1),
    ids: find(parts, (node) => node.type === "button").map((node) => node.key),
    back: button("← Назад"),
    next: button("Далее →")
  };
}
beforeEach(() => {
  state.values = [];
  state.count = 120;
});

it("goes back from the displayed page immediately when a changing result list removes later pages", () => {
  render().next.props.onClick?.();
  render().next.props.onClick?.();
  expect(render().ids[0]).toBe("brick-80");
  // Model/frame updates can shrink the filtered list without using the search controls.
  state.count = 45;
  const shrunk = render();
  expect(shrunk.ids).toHaveLength(5);
  expect(shrunk.ids[0]).toBe("brick-40");
  expect(shrunk.next.props.disabled).toBe(true);
  shrunk.back.props.onClick?.();
  const first = render();
  expect(first.ids[0]).toBe("brick-0");
  expect(first.ids).toHaveLength(40);
  expect(first.back.props.disabled).toBe(true);
  expect(first.next.props.disabled).toBe(false);
  first.next.props.onClick?.();
  expect(render().ids[0]).toBe("brick-40");
});

it("handles a single page and empty dynamic results without stale navigation controls", () => {
  render().next.props.onClick?.();
  state.count = 20;
  expect(render().ids).toHaveLength(20);
  expect(render().ids[0]).toBe("brick-0");
  expect(render().back).toBeUndefined();
  expect(render().next).toBeUndefined();
  state.count = 0;
  expect(render().ids).toEqual([]);
  expect(render().back).toBeUndefined();
});

it.each([
  ["  BRICK-119  ", ["brick-119"]],
  [" \tКИРПИЧ\n ", Array.from({ length: 40 }, (_, i) => `brick-${i}`)],
  [" \t ", Array.from({ length: 40 }, (_, i) => `brick-${i}`)],
  ["  missing  ", []]
])("ignores surrounding whitespace in search %j and resets pagination", (query, expected) => {
  render().next.props.onClick?.();
  render().search?.props.onChange?.({ target: { value: query as string } });
  expect(render().ids).toEqual(expected);
});
