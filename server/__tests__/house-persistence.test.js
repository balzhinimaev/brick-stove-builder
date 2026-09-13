import { expect, it } from "vitest";
import { HOUSE_RUSSIAN_STOVE, HOUSE_RUSSIAN_STOVE_R2 } from "../../src/domain/houseRussianStove";
import { Project } from "../models/Project.js";
import { Draft } from "../models/Draft.js";

it.each([HOUSE_RUSSIAN_STOVE, HOUSE_RUSSIAN_STOVE_R2])(
  "$id roundtrips through Project and Draft schemas",
  async (project) => {
    const source = {
      ...project,
      ownerLogin: "house-roundtrip",
      slug: project.id,
      currentRow: 29,
      clientUpdatedAt: 1
    };
    for (const Model of [Project, Draft]) {
      const doc = new Model(source);
      await doc.validate();
      const restored = Model.hydrate(JSON.parse(JSON.stringify(doc)));
      await restored.validate();
      const rows = Object.fromEntries(
        [...restored.rows].map(([row, bricks]) => [row, bricks.map((b) => b.toObject())])
      );
      expect(rows).toMatchObject(project.rows);
      expect(restored.rowCount).toBe(89);
    }
  },
  15000
);
