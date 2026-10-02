import { Children, isValidElement, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { PhysicsPanel } from "../PhysicsPanel";

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useMemo: (compute: () => unknown) => compute(),
  useState: (initial: unknown) => [typeof initial === "function" ? initial() : initial, vi.fn()],
  useRef: (current: unknown) => ({ current }),
  useEffect: vi.fn()
}));

const physics = vi.hoisted(() => ({
  model: {
    settings: { throughRow: 2 },
    totalMassKg: 12,
    foundationN: 100,
    heldN: 0,
    unresolvedN: 0,
    overlapPairs: [],
    blockedJoints: [],
    bearings: [{ issues: [] }],
    bodies: [{ id: "brick-1", name: "Кирпич", row: 1, massKg: 12, shapes: [{ internal: true }] }]
  },
  frame: {
    time: 1,
    released: false,
    maxSpeedMmS: 0,
    displacementsMm: new Float32Array([0.5]),
    rotationsDeg: new Float32Array([0.25]),
    supportReactionN: 100,
    activeContacts: [],
    mechanicalEnergyChangeJ: 0,
    energyToleranceJ: 0.1
  },
  running: false,
  status: "",
  error: null,
  send: vi.fn(),
  elapsedMs: 0
}));
vi.mock("../../hooks/usePhysics", () => ({ usePhysics: () => physics }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("downloads the current physics report with an attached, safely released link", async () => {
  vi.useFakeTimers();
  let attached = false;
  const anchor = {
    href: "",
    download: "",
    click: vi.fn(() => expect(attached).toBe(true)),
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
  const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:parts");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const tree = PhysicsPanel({
    bricks: [],
    grid: { cols: 16, rows: 20, widthCm: 200, lengthCm: 250 },
    rowCount: 2
  });
  const label = "Отчёт JSON ↗";
  function clickExport(node: ReactNode) {
    Children.forEach(node, (child) => {
      if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(child)) return;
      if (child.type === "button" && child.props.children === label) child.props.onClick?.();
      else clickExport(child.props.children);
    });
  }
  clickExport(tree);
  expect(anchor.click).toHaveBeenCalledOnce();
  expect(anchor.remove).toHaveBeenCalledOnce();
  expect(anchor.download).toBe("stove-gravity-review.json");
  expect(anchor.href).toBe("blob:parts");
  const blob = create.mock.calls[0][0] as Blob;
  expect(blob.type).toBe("application/json");
  const report = JSON.parse(await blob.text());
  expect(report).toMatchObject({
    format: "stove-gravity-review-v1",
    settings: physics.model.settings,
    totalMassKg: 12,
    foundationN: 100,
    bodies: [{ id: "brick-1", massKg: 12 }],
    simulation: { time: 1, displacementsMm: [0.5], rotationsDeg: [0.25] }
  });
  expect(report.bodies[0]).not.toHaveProperty("shapes");
  vi.advanceTimersByTime(1500);
  expect(revoke).not.toHaveBeenCalled();
  vi.runAllTimers();
  expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:parts");
});
