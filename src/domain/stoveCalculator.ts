import { RUSSIAN_STOVE } from "./russianStove";
import { CLASSIC_RUSSIAN_STOVE } from "./classicRussianStove";
import { brickPhysicalSolids, cloneRows, gridFromParameters, isInsideGrid } from "./geometry";
import { estimateMaterials } from "./materials";
import type { ReadyProject } from "./types";

/** These are source-based digital reconstructions, NOT construction-approved designs.
 * A passing geometric test must never promote an entry to an approved building design.
 * Adding a family requires its own generator, source dossier and physical regressions.
 */
export const ORDER_RECIPES = [
  {
    id: "teplushka15",
    project: RUSSIAN_STOVE,
    source: "Подгородников, 1992, рис. 30–33",
    sourceUrl: "https://kirpichiki.pro/assets/files/books/podgorodnikov_1992.pdf",
    revision: "teplushka15-reference-v1",
    constructionApproved: false,
    verifiedOutputKw: null
  },
  {
    id: "classic-russian",
    project: CLASSIC_RUSSIAN_STOVE,
    source: "Школьник, 1991, §63, рис. 123–125",
    sourceUrl: "https://sam-stroy.info/tmp/pechi/pechnoe-otoplenie-maloetagnyh-zdanij.pdf#page=113",
    revision: "classic-russian-reference-v1",
    constructionApproved: false,
    verifiedOutputKw: null
  }
] as const;

export type RecipeId = (typeof ORDER_RECIPES)[number]["id"];
export type CalculatorInput = {
  /** From finished floor, NOT from the underside of the foundation. */
  ceilingHeightMm: number;
  firstCourseAboveFloorMm: number;
  /** Requirement supplied by the site design; this is NOT a chimney penetration clearance. */
  requiredTopGapMm: number;
  availableWidthMm: number;
  availableDepthMm: number;
  areaM2: number;
  indoorC: number;
  outdoorC: number;
  /** Sum(U*A), including thermal bridges, excluding ventilation. */
  transmissionWK: number;
  airChangesPerHour: number;
};

/** Example data, not a statement about the user's house. */
export const CALCULATOR_EXAMPLE: CalculatorInput = {
  ceilingHeightMm: 2500,
  firstCourseAboveFloorMm: 0,
  requiredTopGapMm: 350,
  availableWidthMm: 2000,
  availableDepthMm: 2250,
  areaM2: 60,
  indoorC: 20,
  outdoorC: -25,
  transmissionWK: 100,
  airChangesPerHour: 0.5
};

export const CALCULATOR_RANGES: Record<keyof CalculatorInput, readonly [number, number]> = {
  ceilingHeightMm: [2000, 3600],
  firstCourseAboveFloorMm: [0, 1000],
  requiredTopGapMm: [0, 1500],
  availableWidthMm: [700, 2200],
  availableDepthMm: [900, 2600],
  areaM2: [1, 1000],
  indoorC: [5, 35],
  outdoorC: [-70, 20],
  transmissionWK: [0.1, 10000],
  airChangesPerHour: [0, 10]
};

export type CalculatorIssue =
  | "invalid-input"
  | "invalid-temperature"
  | "width"
  | "depth"
  | "ceiling"
  | "output-unverified"
  | "site-design-required"
  | "reference-only";

export function inputProblems(input: CalculatorInput): (keyof CalculatorInput)[] {
  return (Object.keys(CALCULATOR_RANGES) as (keyof CalculatorInput)[]).filter((key) => {
    const [min, max] = CALCULATOR_RANGES[key];
    return !Number.isFinite(input[key]) || input[key] < min || input[key] > max;
  });
}

/** Simplified steady-state design load in kW, not a simulation or heat-loss survey.
 * Air volumetric heat capacity = 0.33 Wh/(m³·K). No arbitrary W/m² insulation preset.
 */
export function calculateHeatLoss(input: CalculatorInput) {
  if (inputProblems(input).length || input.outdoorC >= input.indoorC) return null;
  const deltaK = input.indoorC - input.outdoorC;
  const volumeM3 = (input.areaM2 * input.ceilingHeightMm) / 1000;
  const transmissionKw = (input.transmissionWK * deltaK) / 1000;
  const ventilationKw = (0.33 * input.airChangesPerHour * volumeM3 * deltaK) / 1000;
  return { deltaK, volumeM3, transmissionKw, ventilationKw, totalKw: transmissionKw + ventilationKw };
}

function envelope(project: ReadyProject) {
  const solids = Object.values(project.rows)
    .flat()
    .flatMap((b) =>
      brickPhysicalSolids(b).map((s) => ({
        x1: s.box.x1 * 125,
        x2: s.box.x2 * 125,
        y1: s.box.y1 * 125,
        y2: s.box.y2 * 125,
        top: (b.row - 1) * 70 + s.z2
      }))
    );
  const x1 = Math.min(...solids.map((s) => s.x1));
  const x2 = Math.max(...solids.map((s) => s.x2));
  const y1 = Math.min(...solids.map((s) => s.y1));
  const y2 = Math.max(...solids.map((s) => s.y2));
  const round = (value: number) => Math.round(value * 1e6) / 1e6;
  return {
    x1: round(x1),
    y1: round(y1),
    widthMm: round(x2 - x1),
    depthMm: round(y2 - y1),
    heightMm: round(Math.max(...solids.map((s) => s.top)))
  };
}

const ENVELOPES = Object.fromEntries(ORDER_RECIPES.map((r) => [r.id, envelope(r.project)])) as Record<
  RecipeId,
  ReturnType<typeof envelope>
>;

export function assessRecipe(id: RecipeId, input: CalculatorInput) {
  const recipe = ORDER_RECIPES.find((r) => r.id === id);
  if (!recipe) throw new Error("Unknown or withdrawn recipe");
  const bounds = ENVELOPES[id];
  const invalidFields = inputProblems(input);
  const issues: CalculatorIssue[] = [];
  if (invalidFields.length) issues.push("invalid-input");
  if (input.outdoorC >= input.indoorC) issues.push("invalid-temperature");
  // Include metal in the displayed envelope; no quiet clipping or rescaling.
  const effectiveWidthMm = Math.min(input.availableWidthMm, Math.round(input.availableWidthMm / 125) * 125);
  const effectiveDepthMm = Math.min(input.availableDepthMm, Math.round(input.availableDepthMm / 125) * 125);
  if (bounds.widthMm > effectiveWidthMm) issues.push("width");
  if (bounds.depthMm > effectiveDepthMm) issues.push("depth");
  const topAboveFloorMm = bounds.heightMm + input.firstCourseAboveFloorMm;
  const actualTopGapMm = input.ceilingHeightMm - topAboveFloorMm;
  if (actualTopGapMm < input.requiredTopGapMm) issues.push("ceiling");
  const canGenerateReference = issues.length === 0;
  // No entry currently has a verified heat-output envelope or a site engineering approval.
  issues.push("output-unverified", "site-design-required", "reference-only");
  return {
    id,
    bounds: { ...bounds },
    invalidFields,
    issues,
    topAboveFloorMm,
    actualTopGapMm,
    effectiveWidthMm,
    effectiveDepthMm,
    canGenerateReference,
    constructionApproved: false as const,
    heatLoss: calculateHeatLoss(input)
  };
}

export function generateOrderReference(id: RecipeId, input: CalculatorInput, documentId: string) {
  const assessment = assessRecipe(id, input);
  if (!assessment.canGenerateReference) throw new Error("Incompatible dimensions or invalid calculator input");
  if (!documentId.startsWith("calculated-")) throw new Error("A separate generated document ID is required");
  const recipe = ORDER_RECIPES.find((r) => r.id === id)!;
  const rows = cloneRows(recipe.project.rows);
  const bounds = assessment.bounds;
  // Position only. Sizes, elevations, course count, profiles, seats and flow passages stay unchanged.
  const dx = ((assessment.effectiveWidthMm - bounds.widthMm) / 2 - bounds.x1) / 125;
  const dy = ((assessment.effectiveDepthMm - bounds.depthMm) / 2 - bounds.y1) / 125;
  for (const b of Object.values(rows).flat()) {
    b.x += dx;
    b.y += dy;
  }
  const project: ReadyProject = {
    ...recipe.project,
    id: documentId,
    title: {
      ru: `${recipe.project.title.ru} · расчётная копия`,
      en: `${recipe.project.title.en} · calculator copy`,
      lt: `${recipe.project.title.lt} · skaičiuoklės kopija`
    },
    subtitle: {
      ru: "Учебная реконструкция. Привязка, тепловая мощность и дымоход не утверждены для строительства.",
      en: "Reference reconstruction. Site layout, heat output and chimney are not approved for construction.",
      lt: "Mokomoji rekonstrukcija. Vieta, šiluminė galia ir dūmtraukis nepatvirtinti statybai."
    },
    parameters: {
      ...recipe.project.parameters,
      foundationWidth: input.availableWidthMm / 10,
      foundationLength: input.availableDepthMm / 10,
      roomHeight: input.ceilingHeightMm / 10
    },
    rows,
    lockedRows: [...recipe.project.lockedRows]
  };
  if (
    Object.values(rows)
      .flat()
      .some((b) => !isInsideGrid(b, gridFromParameters(project.parameters)))
  )
    throw new Error("Generated geometry does not fit the editor grid");
  return {
    format: "brick-stove-order-reference" as const,
    version: 1,
    constructionApproved: false as const,
    source: { citation: recipe.source, url: recipe.sourceUrl, recipeRevision: recipe.revision },
    input: { ...input },
    assessment,
    project,
    materials: estimateMaterials(Object.values(rows).flat(), project.parameters),
    limitations: [
      "Digital reconstruction, not a construction-approved design.",
      "Foundation thickness is an inherited editor display value, not a foundation calculation.",
      "Editor vertical zero is the first course. Floor elevation is assessed in this report, not added to the brick coordinates.",
      "Heat loss is an estimate from user-supplied data; heat output and draft are unverified.",
      "Model envelope includes the modelled pipe; top-gap screening is conservative, not a fire-safety certification.",
      "Rows group installation starts; tall wedges and hardware may cross multiple horizontal courses.",
      "Stove position only was translated; no firebox, channel, vault or course was resized."
    ]
  };
}

export type GeneratedOrder = ReturnType<typeof generateOrderReference>;

/** Exact per-part data, including wedge profiles. A parts list, not a substitute for section drawings. */
export function orderPartsCsv(order: GeneratedOrder): string {
  const escapeCsv = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`;
  const lines: unknown[][] = [
    [
      "REFERENCE_ONLY_NOT_FOR_CONSTRUCTION",
      "course",
      "id",
      "kind",
      "part_name",
      "x_mm",
      "y_mm",
      "course_base_mm",
      "orientation",
      "notch_corner",
      "damper_open",
      "custom_geometry_json"
    ]
  ];
  for (const [row, bricks] of Object.entries(order.project.rows))
    for (const b of bricks)
      lines.push([
        "reference-only",
        row,
        b.id,
        b.kind,
        b.custom?.name ?? b.kind,
        b.x * 125,
        b.y * 125,
        (b.row - 1) * 70,
        b.orientation,
        b.notchCorner ?? "",
        b.damperOpen ?? "",
        JSON.stringify(b.custom ?? null)
      ]);
  return `\uFEFF${lines.map((line) => line.map(escapeCsv).join(",")).join("\r\n")}\r\n`;
}
