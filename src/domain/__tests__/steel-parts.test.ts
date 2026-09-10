import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { brickPhysicalOverlap, brickSolids, cloneRows, cutBrickForPlate, planPlacement } from "../geometry";
import { DEFAULT_PARAMETERS } from "../constants";
import { estimateMaterials, isSteelPart } from "../materials";
import type { PlacedBrick } from "../types";
import { brickAppearance, isMasonry } from "../../components/three/brickAppearance";
import { profileSceneGeometry } from "../../components/three/profileGeometry";
import { MaterialsSummary } from "../../components/MaterialsSummary";
import { translations } from "../../i18n";

/** Example section thickness 3 mm is a test assumption, not a source-drawing claim. */
function angleLeg(id: string, width: number, bottom: number, top: number): PlacedBrick {
  return {
    id,
    row: 11,
    x: 0,
    y: 0,
    kind: "custom",
    orientation: "h",
    custom: {
      name: "Steel angle leg",
      material: "steel",
      w: width / 125,
      h: 1030 / 125,
      profileXZ: [
        { x: 0, z: bottom },
        { x: width, z: bottom },
        { x: width, z: top },
        { x: 0, z: top }
      ]
    }
  };
}
const legs = [angleLeg("horizontal-leg", 30, 0, 3), angleLeg("vertical-leg", 3, 3, 30)];

describe("source structural steel parts", () => {
  it("represents an angle with nonintersecting exact legs, not two full bounding boxes", () => {
    expect(brickPhysicalOverlap(legs[0], legs[1])).toBe(false);
    for (const leg of legs) {
      expect(brickSolids(leg)[0].polyhedron).toBeDefined();
      expect(isSteelPart(leg)).toBe(true);
    }
    const materials = estimateMaterials(legs, DEFAULT_PARAMETERS);
    expect(materials.steelPieces).toBe(2); // geometric parts, not the quantity of purchased angles
    expect(materials.steelKg).toBeCloseTo(((30 * 3 + 27 * 3) * 1030 * 7850) / 1e9, 9);
    expect(materials.regularBricks + materials.cutBricks + materials.firebricks).toBe(0);
    expect(materials.mortarM3).toBe(0);
    expect(materials.total).toBe(2);
  });
  it("retains default masonry and gives explicit steel priority over inherited cut metadata", () => {
    const legacy: PlacedBrick = {
      id: "brick",
      kind: "custom",
      orientation: "h",
      row: 1,
      x: 1,
      y: 1,
      custom: { name: "Fireclay", w: 2, h: 1, cutFrom: "firebrick" }
    };
    const steel: PlacedBrick = {
      ...legacy,
      custom: { ...legacy.custom, name: "Steel", w: 2, h: 1, material: "steel" }
    };
    expect(estimateMaterials([legacy], DEFAULT_PARAMETERS).firebricks).toBe(1);
    const materials = estimateMaterials([steel], DEFAULT_PARAMETERS);
    expect(materials.firebricks).toBe(0);
    expect(materials.steelKg).toBeCloseTo((250 * 125 * 65 * 7850) / 1e9, 9);
    expect(materials.mortarM3).toBe(0);
    expect(isMasonry(legacy)).toBe(true);
    expect(isMasonry(steel)).toBe(false);
  });
  it("renders metal properties and physical thin dimensions without a mortar bed", () => {
    const material = brickAppearance(legs[0]);
    expect(material.color.getHexString()).toBe("535c62");
    expect(material.metalness).toBe(0.75);
    expect(isMasonry(legs[0])).toBe(false);
    const mesh = profileSceneGeometry(legs[0], { cols: 12, rows: 12, widthCm: 150, lengthCm: 150 });
    const bounds = mesh.boundingBox;
    if (!bounds) throw new Error("Mesh bounds not computed");
    expect((bounds.max.y - bounds.min.y) * 125).toBeCloseTo(3, 3);
    expect((bounds.max.z - bounds.min.z) * 125).toBeCloseTo(1030, 3);
    mesh.dispose();
  });
  it("does not turn steel into a brick through automatic plate-seat cuts", () => {
    const steel: PlacedBrick = { ...legs[0], custom: { name: "Rectangular steel", material: "steel", w: 2, h: 1 } };
    expect(cutBrickForPlate(steel, { ...steel, kind: "plate" }, 14)).toBeNull();
    const grid = { cols: 12, rows: 12, widthCm: 150, lengthCm: 150 };
    expect(planPlacement({}, 11, [{ ...steel, kind: "firebrick" }], grid).rows).toBeNull();
  });
  it("preserves material and independently cloned profile points through JSON", () => {
    const original = { 11: legs };
    const copied = cloneRows(JSON.parse(JSON.stringify(original)));
    expect(copied).toEqual(original);
    expect(copied[11][0].custom?.material).toBe("steel");
  });
  it("shows approximate mass only when steel exists, including legacy estimate objects", () => {
    const t = (key: keyof typeof translations.ru) => translations.ru[key];
    const empty = estimateMaterials([], DEFAULT_PARAMETERS);
    expect(renderToStaticMarkup(createElement(MaterialsSummary, { materials: empty, t }))).not.toContain("Сталь");
    const legacyEstimate = { ...empty };
    delete legacyEstimate.steelKg;
    delete legacyEstimate.steelPieces;
    expect(renderToStaticMarkup(createElement(MaterialsSummary, { materials: legacyEstimate, t }))).not.toContain(
      "Сталь"
    );
    const steel = estimateMaterials(legs, DEFAULT_PARAMETERS);
    const html = renderToStaticMarkup(createElement(MaterialsSummary, { materials: steel, t }));
    expect(html).toContain("Сталь, кг (≈)");
    expect(html).toContain((steel.steelKg ?? 0).toFixed(2));
  });
});
