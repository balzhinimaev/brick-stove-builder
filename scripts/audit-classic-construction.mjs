/** Read-only manufacturing audit; not a structural, thermal or construction approval. */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = resolve(root, process.argv[2] ?? "docs/classic-construction/audit");
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const rounded = (value) => Math.round(value * 1e6) / 1e6;
const server = await createServer({
  root,
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, watch: null, preTransformRequests: false },
  appType: "custom"
});

try {
  const { CLASSIC_RUSSIAN_STOVE: project } = await server.ssrLoadModule("/src/domain/classicRussianStove.ts");
  const { RUSSIAN_STOVE: teplushka } = await server.ssrLoadModule("/src/domain/russianStove.ts");
  const { brickPhysicalSolids, COURSE_MM } = await server.ssrLoadModule("/src/domain/geometry/collisions.ts");
  const { MM_PER_CELL } = await server.ssrLoadModule("/src/domain/constants.ts");
  const before = { classic: hash(project), teplushka: hash(teplushka) };
  const stock = Object.values(project.rows).flat();
  const isMasonry = (b) => b.kind === "custom" && b.custom?.material !== "steel";
  const solids = stock.flatMap((b) =>
    brickPhysicalSolids(b).map((s) => ({
      id: b.id,
      row: b.row,
      masonry: isMasonry(b),
      x1: s.box.x1 * MM_PER_CELL,
      x2: s.box.x2 * MM_PER_CELL,
      y1: s.box.y1 * MM_PER_CELL,
      y2: s.box.y2 * MM_PER_CELL,
      z1: (b.row - 1) * COURSE_MM + s.z1,
      z2: (b.row - 1) * COURSE_MM + s.z2
    }))
  );
  const bounds = (parts) =>
    Object.fromEntries(
      ["x", "y", "z"].map((axis) => [
        axis,
        [rounded(Math.min(...parts.map((s) => s[`${axis}1`]))), rounded(Math.max(...parts.map((s) => s[`${axis}2`])))]
      ])
    );

  // Compare actual axis-aligned ceramic solids, not renderer-inset meshes.
  // Profile cuts are intentionally excluded: they need stock-oriented shop drawings.
  const rectangles = stock
    .filter((b) => isMasonry(b) && !b.custom.profileXZ && b.custom.cutFrom === "standard")
    .map((b) => {
      const physical = brickPhysicalSolids(b);
      if (physical.length !== 1 || physical[0].polyhedron) return null;
      const s = physical[0];
      const dimensions = [
        rounded((s.box.x2 - s.box.x1) * MM_PER_CELL),
        rounded((s.box.y2 - s.box.y1) * MM_PER_CELL),
        rounded(s.z2 - s.z1)
      ];
      const sorted = [...dimensions].sort((a, c) => a - c);
      return {
        id: b.id,
        row: b.row,
        name: b.custom.name,
        dimensionsMm: dimensions,
        orthogonalStockFit: sorted.every((value, i) => value <= [65, 120, 250][i] + 1e-6),
        // A review threshold, not a code-prescribed minimum or a strength test.
        planDimensionUnder25Mm: Math.min(...dimensions.slice(0, 2)) < 25 - 1e-6
      };
    })
    .filter(Boolean);
  const rectangularIds = new Set(rectangles.map((b) => b.id));
  const rectangularSolids = solids.filter((s) => rectangularIds.has(s.id));
  const zeroPlanJoints = [];
  for (let i = 0; i < rectangularSolids.length; i++) {
    const a = rectangularSolids[i];
    for (let j = i + 1; j < rectangularSolids.length; j++) {
      const b = rectangularSolids[j];
      if (a.row !== b.row || Math.min(a.z2, b.z2) - Math.max(a.z1, b.z1) <= 1e-6) continue;
      for (const [axis, cross] of [
        ["x", "y"],
        ["y", "x"]
      ]) {
        const touches =
          Math.abs(a[`${axis}2`] - b[`${axis}1`]) < 1e-6 || Math.abs(b[`${axis}2`] - a[`${axis}1`]) < 1e-6;
        const overlap = Math.min(a[`${cross}2`], b[`${cross}2`]) - Math.max(a[`${cross}1`], b[`${cross}1`]);
        if (touches && overlap > 1e-6) zeroPlanJoints.push({ first: a.id, second: b.id, row: a.row, axis, gapMm: 0 });
      }
    }
  }
  const issues = rectangles.filter((b) => !b.orthogonalStockFit || b.planDimensionUnder25Mm);
  // The x=625 boundary belongs specifically to this source reconstruction, not to all stove projects.
  const body = bounds(solids.filter((s) => s.masonry && s.x1 >= 625 - 1e-6));
  // Representative clear section of the right upper duct, not its full-path minimum.
  const ductPoint = { x: 1605, y: 1125, z: 2000 };
  const atPlanPoint = solids.filter(
    (s) => s.x1 < ductPoint.x && s.x2 > ductPoint.x && s.y1 < ductPoint.y && s.y2 > ductPoint.y
  );
  const atSidePoint = solids.filter(
    (s) => s.y1 < ductPoint.y && s.y2 > ductPoint.y && s.z1 < ductPoint.z && s.z2 > ductPoint.z
  );
  const ductFloor = Math.max(...atPlanPoint.filter((s) => s.z2 < ductPoint.z).map((s) => s.z2));
  const ductRoof = Math.min(...atPlanPoint.filter((s) => s.z1 > ductPoint.z).map((s) => s.z1));
  const ductLeft = Math.max(...atSidePoint.filter((s) => s.x2 < ductPoint.x).map((s) => s.x2));
  const ductRight = Math.min(...atSidePoint.filter((s) => s.x1 > ductPoint.x).map((s) => s.x1));
  if (![ductFloor, ductRoof, ductLeft, ductRight].every(Number.isFinite)) {
    throw new Error(
      "The documented duct sampling location no longer has four finite boundaries; review it before updating the report"
    );
  }
  const after = { classic: hash(project), teplushka: hash(teplushka) };
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("Audit mutated a project");
  const result = {
    projectId: project.id,
    modelSourceSha256: createHash("sha256")
      .update(readFileSync(resolve(root, "src/domain/classicRussianStove.ts")))
      .digest("hex"),
    projectJsonSha256: before.classic,
    teplushkaJsonSha256: before.teplushka,
    stage: "design-basis-not-for-construction",
    constructionApproved: false,
    totalModelParts: stock.length,
    courses: project.rowCount,
    rectangularMasonryPartsChecked: rectangles.length,
    orthogonalStockFitFailures: rectangles.filter((b) => !b.orthogonalStockFit).length,
    planDimensionsUnder25Mm: rectangles.filter((b) => b.planDimensionUnder25Mm).length,
    zeroPlanJointPairs: zeroPlanJoints.length,
    coordinateNote: "mm from editor origin; z=0 is bottom of first course, not finished floor",
    overallBoundsMm: bounds(solids),
    bodyBoundsMm: body,
    upperRightDuctSample: {
      pointMm: ductPoint,
      clearWidthMm: rounded(ductRight - ductLeft),
      clearHeightMm: rounded(ductRoof - ductFloor),
      floorMm: ductFloor,
      soffitMm: ductRoof,
      note: "Single straight section of current physical model, not a whole-path minimum or a drawing instruction"
    },
    ceilingScenario: {
      confirmedByUser: false,
      ceilingAboveFloorMm: 2500,
      firstCourseAboveFloorMm: 0,
      bodyTopAboveFirstCourseMm: body.z[1],
      gapAboveBodyMm: rounded(2500 - body.z[1]),
      note: "A hypothetical placement, not an assessment of the user's actual ceiling or chimney penetration"
    },
    limitations: [
      "Orthogonal stock fit only; not an arbitrary 3D nesting calculation",
      "Profile parts excluded from the rectangular audit",
      "25 mm is a reporting threshold, not a minimum permitted cut size",
      "Visual mortar gaps do not change these physical solids or exported dimensions",
      "No strength, bond completeness, draft, thermal output, airtightness or site compliance certification"
    ],
    partFindingExamples: issues.slice(0, 10),
    zeroPlanJointExamples: zeroPlanJoints.slice(0, 20)
  };
  mkdirSync(destination, { recursive: true });
  writeFileSync(resolve(destination, "measurements.json"), `${JSON.stringify(result, null, 2)}\n`);
  const csv = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const lines = [["id", "row", "name", "x_mm", "y_mm", "z_mm", "orthogonal_stock_fit", "plan_dimension_under_25mm"]];
  for (const b of issues)
    lines.push([b.id, b.row, b.name, ...b.dimensionsMm, b.orthogonalStockFit, b.planDimensionUnder25Mm]);
  writeFileSync(
    resolve(destination, "part-findings.csv"),
    `\uFEFF${lines.map((line) => line.map(csv).join(",")).join("\n")}\n`
  );
  console.log(
    JSON.stringify({
      parts: stock.length,
      oversize: result.orthogonalStockFitFailures,
      narrow: result.planDimensionsUnder25Mm,
      zeroJoints: zeroPlanJoints.length,
      bodyTopMm: body.z[1],
      unchanged: before,
      output: destination
    })
  );
} finally {
  await server.close();
}
