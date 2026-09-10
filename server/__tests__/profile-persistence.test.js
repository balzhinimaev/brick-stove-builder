import { describe, expect, it } from "vitest";
import { Project } from "../models/Project.js";
import { Draft } from "../models/Draft.js";
import { normalizeProject } from "../lib/project.js";

const parameters = { foundationWidth: 129, foundationLength: 129, foundationThickness: 25, roomHeight: 280 };
const brick = {
  id: "vault-17",
  row: 17,
  x: 2.04,
  y: 3.08,
  kind: "custom",
  orientation: "v",
  custom: {
    name: "Individual fireclay voussoir",
    w: 2,
    h: 0.96,
    cutFrom: "firebrick",
    profileXZ: [
      { x: 0, z: 14 },
      { x: 250, z: 130 },
      { x: 235, z: 196 },
      { x: 10, z: 79 }
    ]
  }
};
const shared = { ownerLogin: "schema-test", parameters, rowCount: 33, rows: { 17: [brick] } };
const makeProject = (candidate = brick) =>
  new Project({ ...shared, title: { ru: "Теплушка" }, rows: { 17: [candidate] } });
const makeDraft = (candidate = brick) =>
  new Draft({ ...shared, currentRow: 17, clientUpdatedAt: 1, rows: { 17: [candidate] } });

describe("strict vertical-profile persistence", () => {
  for (const [name, make] of [
    ["Project", makeProject],
    ["Draft", makeDraft]
  ]) {
    it(`${name} retains every profile coordinate through document JSON and rehydration`, async () => {
      const doc = make();
      await doc.validate();
      const transport = JSON.parse(JSON.stringify(doc));
      const restored = doc.constructor.hydrate(transport);
      await restored.validate();
      expect(restored.rows.get("17")[0].custom.profileXZ.map(({ x, z }) => ({ x, z }))).toEqual(brick.custom.profileXZ);
      expect(restored.rows.get("17")[0].custom.h).toBe(0.96);
      expect(restored.rows.get("17")[0].custom.cutFrom).toBe("firebrick");
    });
    it(`${name} rejects invalid profiles instead of silently saving bounding boxes`, async () => {
      for (const custom of [
        { ...brick.custom, w: 1 },
        {
          ...brick.custom,
          profileXZ: [
            { x: 0, z: 0 },
            { x: 250, z: 0 },
            { x: 120, z: 5 },
            { x: 0, z: 65 }
          ]
        },
        {
          ...brick.custom,
          profileXZ: [
            { x: 0, z: 0 },
            { x: 250, z: NaN },
            { x: 0, z: 65 }
          ]
        },
        { ...brick.custom, notch: { x1: 0, x2: 1, y1: 0, y2: 1 } },
        { ...brick.custom, seatZMm: 22 }
      ])
        await expect(make({ ...brick, custom }).validate()).rejects.toThrow();
      await expect(make({ ...brick, kind: "plate" }).validate()).rejects.toThrow();
    });
    it(`${name} keeps legacy documents without adding a phantom profile`, async () => {
      const legacy = { ...brick, custom: { name: "Ordinary cut", w: 2, h: 1 } };
      const doc = make(legacy);
      await doc.validate();
      expect(doc.rows.get("17")[0].custom.profileXZ).toBeUndefined();
    });
  }
  it("normalizes API project rows without losing the nested profile", () => {
    const payload = normalizeProject(makeProject());
    expect(JSON.parse(JSON.stringify(payload.rows))[17][0].custom.profileXZ).toEqual(brick.custom.profileXZ);
  });
});

describe("thin vertical gate persistence", () => {
  const gate = {
    ...brick,
    kind: "damper",
    damperOpen: 0.5,
    custom: {
      name: "Summer gate",
      w: 4 / 125,
      h: 150 / 125,
      heightMm: 150,
      seatZMm: 60,
      damperPlane: "vertical",
      damperSlide: "y-negative",
      damperFrameMm: 10
    }
  };
  for (const [name, make] of [
    ["Project", makeProject],
    ["Draft", makeDraft]
  ]) {
    it(`${name} preserves 4 mm actual metal thickness and source-oriented sweep`, async () => {
      const doc = make(gate);
      await doc.validate();
      const restored = doc.constructor.hydrate(JSON.parse(JSON.stringify(doc)));
      await restored.validate();
      const result = restored.rows.get("17")[0];
      expect(result.custom.w * 125).toBe(4);
      expect(result.custom.damperPlane).toBe("vertical");
      expect(result.custom.damperSlide).toBe("y-negative");
      expect(result.custom.damperFrameMm).toBe(10);
      expect(result.damperOpen).toBe(0.5);
    });
    it(`${name} rejects malformed new gate dimensions and incompatible axes`, async () => {
      await expect(make({ ...gate, custom: { ...gate.custom, heightMm: undefined } }).validate()).rejects.toThrow();
      await expect(
        make({ ...gate, custom: { ...gate.custom, damperSlide: "x-positive" } }).validate()
      ).rejects.toThrow();
      await expect(make({ ...gate, custom: { ...gate.custom, damperFrameMm: 75 } }).validate()).rejects.toThrow();
    });
  }
});

describe("structural steel persistence", () => {
  const steel = { ...brick, custom: { ...brick.custom, material: "steel" } };
  for (const [name, make] of [
    ["Project", makeProject],
    ["Draft", makeDraft]
  ]) {
    it(`${name} retains explicit steel material and exact profile without adding it to legacy bricks`, async () => {
      const doc = make(steel);
      await doc.validate();
      const restored = doc.constructor.hydrate(JSON.parse(JSON.stringify(doc)));
      await restored.validate();
      const custom = restored.rows.get("17")[0].custom;
      expect(custom.material).toBe("steel");
      expect(custom.profileXZ.map(({ x, z }) => ({ x, z }))).toEqual(brick.custom.profileXZ);
      expect(make(brick).rows.get("17")[0].custom.material).toBeUndefined();
    });
    it(`${name} rejects unsupported material and material on a non-custom kind`, async () => {
      await expect(make({ ...steel, custom: { ...steel.custom, material: "wood" } }).validate()).rejects.toThrow();
      await expect(make({ ...steel, kind: "firebrick" }).validate()).rejects.toThrow();
    });
  }
});
