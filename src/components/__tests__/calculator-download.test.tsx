import { Children, isValidElement, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { CALCULATOR_EXAMPLE } from "../../domain/stoveCalculator";
import { StoveCalculator } from "../StoveCalculator";
import { calculatorText } from "../stoveCalculatorText";

const { setError } = vi.hoisted(() => ({ setError: vi.fn() }));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useMemo: (compute: () => unknown) => compute(),
  useState: (initial: unknown) => [initial, setError]
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  setError.mockClear();
});

it.each([
  ["json", "download", "order.json", "application/json"],
  ["csv", "csv", "parts.csv", "text/csv;charset=utf-8"],
  ["html", "sheet", "sections.html", "text/html;charset=utf-8"]
] as const)("cleans up a blocked %s export and reports failure", async (_format, label, suffix, mime) => {
  vi.useFakeTimers();
  let attached = false;
  const anchor = {
    href: "",
    download: "",
    click: vi.fn(() => {
      expect(attached).toBe(true);
      throw new Error("Download blocked");
    }),
    remove: vi.fn(() => {
      attached = false;
    })
  };
  vi.stubGlobal("document", {
    createElement: () => anchor,
    body: {
      append: () => {
        attached = true;
      }
    }
  });
  const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:reference");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const tree = StoveCalculator({
    locale: "ru",
    input: { ...CALCULATOR_EXAMPLE, ceilingHeightMm: 3200 },
    onChange: vi.fn(),
    onOpen: vi.fn()
  });
  let clicked = false;
  function clickExport(node: ReactNode) {
    Children.forEach(node, (child) => {
      if (!isValidElement<{ children?: ReactNode; disabled?: boolean; onClick?: () => void }>(child)) return;
      if (!clicked && child.type === "button" && child.props.children === calculatorText("ru")(label)) {
        expect(child.props.disabled).toBe(false);
        clicked = true;
        child.props.onClick?.();
      } else clickExport(child.props.children);
    });
  }
  clickExport(tree);
  expect(anchor.click).toHaveBeenCalledOnce();
  expect(anchor.remove).toHaveBeenCalledOnce();
  expect(attached).toBe(false);
  expect(anchor.download).toBe(`teplushka15-reference-${suffix}`);
  const blob = create.mock.calls[0][0] as Blob;
  expect(blob.type).toBe(mime);
  expect((await blob.text()).length).toBeGreaterThan(100);
  expect(setError).toHaveBeenLastCalledWith(calculatorText("ru")("fail"));
  vi.advanceTimersByTime(29999);
  expect(revoke).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:reference");
});
