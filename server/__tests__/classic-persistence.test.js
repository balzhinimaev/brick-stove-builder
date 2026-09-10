import { expect, it } from "vitest";
import { CLASSIC_RUSSIAN_STOVE } from "../../src/domain/classicRussianStove";
import { Project } from "../models/Project.js";
import { Draft } from "../models/Draft.js";

it("roundtrips the full independent classic project through existing Project and Draft schemas", async () => {
  const source = {
    ...CLASSIC_RUSSIAN_STOVE,
    ownerLogin: "classic-roundtrip",
    slug: CLASSIC_RUSSIAN_STOVE.id,
    currentRow: 35,
    clientUpdatedAt: 1
  };
  for (const Model of [Project, Draft]) {
    const doc = new Model(source);
    await doc.validate();
    const restored = Model.hydrate(JSON.parse(JSON.stringify(doc)));
    await restored.validate();
    const rows = Object.fromEntries([...restored.rows].map(([row, bricks]) => [row, bricks.map((b) => b.toObject())]));
    expect(rows).toMatchObject(CLASSIC_RUSSIAN_STOVE.rows);
    expect(restored.rowCount).toBe(35);
  }
}, 15000);
