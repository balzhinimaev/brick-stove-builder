import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  assessRecipe,
  CALCULATOR_EXAMPLE,
  calculateHeatLoss,
  generateOrderReference,
  inputProblems,
  ORDER_RECIPES,
  orderPartsCsv,
  type RecipeId
} from "../stoveCalculator";
import { horizontalSection, orderReferenceHtml } from "../orderReferenceHtml";
import { brickPhysicalSolids, gridFromParameters, isInsideGrid, solidPolyhedron } from "../geometry";
import { StoveCalculator } from "../../components/StoveCalculator";
import { CLASSIC_ARCH_NAMES, classicArchAssembly } from "../../components/builder/classicArchAssembly";

const roomy = { ...CALCULATOR_EXAMPLE, ceilingHeightMm: 3200 };

describe("calculator validity and physical limits", () => {
  it("uses independent transmission and ventilation terms, with unit conversion", () => {
    const result = calculateHeatLoss(CALCULATOR_EXAMPLE)!;
    expect(result.volumeM3).toBe(150);
    expect(result.transmissionKw).toBe(4.5);
    expect(result.ventilationKw).toBeCloseTo(1.11375);
    expect(result.totalKw).toBeCloseTo(5.61375);
    expect(calculateHeatLoss({ ...CALCULATOR_EXAMPLE, airChangesPerHour: 0 })?.totalKw).toBe(4.5);
  });

  it("rejects empty, nonfinite, out-of-range and nonsensical temperatures", () => {
    for (const value of [NaN, Infinity, -1, 100000]) {
      const input = { ...roomy, ceilingHeightMm: value };
      expect(inputProblems(input)).toContain("ceilingHeightMm");
      expect(calculateHeatLoss(input)).toBeNull();
      expect(() => generateOrderReference("teplushka15", input, "calculated-invalid")).toThrow();
    }
    expect(calculateHeatLoss({ ...roomy, outdoorC: 20, indoorC: 20 })).toBeNull();
  });

  it("rejects incompatible height without deleting courses or shrinking them", () => {
    for (const recipe of ORDER_RECIPES) {
      const a = assessRecipe(recipe.id, CALCULATOR_EXAMPLE);
      expect(a.issues).toContain("ceiling");
      expect(a.canGenerateReference).toBe(false);
      expect(() => generateOrderReference(recipe.id, CALCULATOR_EXAMPLE, "calculated-low")).toThrow();
    }
    const baseline = assessRecipe("teplushka15", roomy);
    const raised = assessRecipe("teplushka15", { ...roomy, firstCourseAboveFloorMm: 200 });
    expect(baseline.actualTopGapMm - raised.actualTopGapMm).toBe(200);
  });

  it("uses the conservative envelope and accounts for editor grid rounding", () => {
    expect(assessRecipe("classic-russian", { ...roomy, availableWidthMm: 1000 }).issues).toContain("width");
    expect(assessRecipe("classic-russian", { ...roomy, availableDepthMm: 1000 }).issues).toContain("depth");
    const a = assessRecipe("teplushka15", { ...roomy, availableWidthMm: 1290 });
    expect(a.bounds.widthMm).toBe(1290);
    expect(a.effectiveWidthMm).toBe(1250);
    expect(a.canGenerateReference).toBe(false);
  });

  it("never uses the withdrawn POV or promotes a reference model to construction approval", () => {
    expect(ORDER_RECIPES.map((r) => r.id)).not.toContain("shkolnik-pov-3500");
    expect(() => assessRecipe("shkolnik-pov-3500" as RecipeId, roomy)).toThrow();
    for (const r of ORDER_RECIPES) {
      const a = assessRecipe(r.id, roomy);
      expect(a.canGenerateReference).toBe(true);
      expect(a.constructionApproved).toBe(false);
      expect(a.issues).toContain("output-unverified");
      expect(a.issues).toContain("site-design-required");
    }
  });
});

describe("generated row documents", () => {
  it("deep clones every part and only translates the complete plan as a rigid group", () => {
    for (const r of ORDER_RECIPES) {
      const originalJson = JSON.stringify(r.project);
      const order = generateOrderReference(r.id, roomy, `calculated-${r.id}`);
      const original = Object.values(r.project.rows).flat();
      const copied = Object.values(order.project.rows).flat();
      expect(order.project.rowCount).toBe(r.project.rowCount);
      expect(copied).toHaveLength(original.length);
      const dx = copied[0].x - original[0].x,
        dy = copied[0].y - original[0].y;
      for (let i = 0; i < copied.length; i++) {
        const b = copied[i],
          source = original[i];
        expect(b.x - source.x).toBeCloseTo(dx, 9);
        expect(b.y - source.y).toBeCloseTo(dy, 9);
        expect(b.row).toBe(source.row);
        expect(b.kind).toBe(source.kind);
        expect(b.orientation).toBe(source.orientation);
        expect(b.damperOpen).toBe(source.damperOpen);
        expect(b.custom).toEqual(source.custom);
        expect(isInsideGrid(b, gridFromParameters(order.project.parameters))).toBe(true);
      }
      const wedge = copied.find((b) => b.custom?.profileXZ)!;
      wedge.custom!.profileXZ![0].x += 1;
      expect(JSON.stringify(r.project)).toBe(originalJson);
      expect(order.constructionApproved).toBe(false);
    }
  });

  it("preserves translated arch inspection but rejects a changed wedge", () => {
    const order = generateOrderReference("classic-russian", roomy, "calculated-arch");
    const bricks = Object.values(order.project.rows).flat();
    for (const name of CLASSIC_ARCH_NAMES) {
      const assembly = classicArchAssembly(bricks, name)!;
      expect(assembly).not.toBeNull();
      expect(Number.isFinite(assembly.offsetMm.x)).toBe(true);
    }
    bricks.find((b) => b.custom?.name.startsWith("Арка устья · клин"))!.x += 0.1;
    expect(classicArchAssembly(bricks, "Арка устья")).toBeNull();
  });

  it("exports complete JSON/CSV geometry and unambiguous reference-only provenance", () => {
    const order = generateOrderReference("teplushka15", roomy, "calculated-export");
    const rehydrated = JSON.parse(JSON.stringify(order));
    expect(rehydrated.project.rows).toEqual(order.project.rows);
    expect(rehydrated.source.url).toMatch(/^https:\/\//);
    expect(rehydrated.constructionApproved).toBe(false);
    const csv = orderPartsCsv(order);
    expect(csv).toContain("REFERENCE_ONLY_NOT_FOR_CONSTRUCTION");
    expect(csv).toContain("profileXZ");
    expect(csv.split("\r\n")).toHaveLength(order.materials.total + 2);
  });

  it("sections a wedge at its actual width, not its enclosing rectangle", () => {
    const [solid] = brickPhysicalSolids({
      kind: "custom",
      x: 0,
      y: 0,
      orientation: "h",
      custom: {
        name: "wedge",
        w: 100 / 125,
        h: 120 / 125,
        profileXZ: [
          { x: 0, z: 0 },
          { x: 100, z: 0 },
          { x: 80, z: 65 },
          { x: 20, z: 65 }
        ]
      }
    });
    const points = horizontalSection(solidPolyhedron(solid), 32.5);
    expect(Math.min(...points.map((p) => p.x))).toBeCloseTo(10);
    expect(Math.max(...points.map((p) => p.x))).toBeCloseTo(90);
    expect(horizontalSection(solidPolyhedron(solid), 100)).toEqual([]);
  });

  it("exports all reference sections offline, escapes names and embeds no executable script", () => {
    const order = generateOrderReference("teplushka15", roomy, "calculated-print");
    order.project.title.ru = "<script>alert(1)</script>";
    const html = orderReferenceHtml(order);
    expect(html.match(/<article>/g)).toHaveLength(order.project.rowCount);
    expect(html.match(/<svg /g)).toHaveLength(order.project.rowCount);
    expect(html).toContain("НЕ ДЛЯ КЛАДКИ");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("<polygon");
  });

  it("renders incompatible and compatible calculator states without browser testing", () => {
    const render = (input: typeof roomy) =>
      renderToStaticMarkup(<StoveCalculator locale="ru" input={input} onChange={() => {}} onOpen={() => {}} />);
    expect(render(CALCULATOR_EXAMPLE).match(/disabled=""/g)).toHaveLength(8);
    const html = render(roomy);
    expect(html).not.toContain("disabled=");
    expect(html).toContain("Утверждённых строительных схем в генераторе пока нет");
    expect(html).toContain("ПОВ-3500 исключена");
  });
});
