import { expect, it } from "vitest";
import { HOUSE_RUSSIAN_STOVE } from "../../src/domain/houseRussianStove";
import { Project } from "../models/Project.js";
import { Draft } from "../models/Draft.js";

it("roundtrips the full house 6x9 project through existing Project and Draft schemas", async () => {
  const source = {
    ...HOUSE_RUSSIAN_STOVE,
    ownerLogin: "house-roundtrip",
    slug: HOUSE_RUSSIAN_STOVE.id,
    currentRow: 29,
    clientUpdatedAt: 1
  };
  for (const Model of [Project, Draft]) {
    const doc = new Model(source);
    await doc.validate();
    const restored = Model.hydrate(JSON.parse(JSON.stringify(doc)));
    await restored.validate();
    const rows = Object.fromEntries([...restored.rows].map(([row, bricks]) => [row, bricks.map((b) => b.toObject())]));
    expect(rows).toMatchObject(HOUSE_RUSSIAN_STOVE.rows);
    expect(restored.rowCount).toBe(89);
  }
}, 15000);
