import { brickPhysicalSolids, solidPolyhedron } from "./geometry";
import type { ConvexPolyhedron } from "./geometry";
import type { GeneratedOrder } from "./stoveCalculator";

const escapeHtml = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[c]!
  );

/** Intersect actual convex solids with a horizontal plane, including wedges
 * beginning on earlier courses. Not a bounding-rectangle projection.
 */
export function horizontalSection(shape: ConvexPolyhedron, z: number): { x: number; y: number }[] {
  const points = new Map<string, { x: number; y: number }>();
  const add = (p: { x: number; y: number }) => points.set(`${p.x.toFixed(6)},${p.y.toFixed(6)}`, { x: p.x, y: p.y });
  for (const face of shape.faces)
    for (let i = 0; i < face.length; i++) {
      const a = shape.vertices[face[i]],
        b = shape.vertices[face[(i + 1) % face.length]];
      if (Math.abs(a.z - z) < 1e-7) add(a);
      if ((a.z < z && b.z > z) || (a.z > z && b.z < z)) {
        const fraction = (z - a.z) / (b.z - a.z);
        add({ x: a.x + fraction * (b.x - a.x), y: a.y + fraction * (b.y - a.y) });
      }
    }
  const values = [...points.values()];
  if (values.length < 3) return [];
  const cx = values.reduce((sum, p) => sum + p.x, 0) / values.length;
  const cy = values.reduce((sum, p) => sum + p.y, 0) / values.length;
  return values.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
}

/** Self-contained reference sheet; printable by the user to PDF. No remote assets or script. */
export function orderReferenceHtml(order: GeneratedOrder, locale: "ru" | "en" | "lt" = "ru"): string {
  const ru = locale === "ru";
  const project = order.project;
  const width = project.parameters.foundationWidth * 10,
    depth = project.parameters.foundationLength * 10;
  const shapes = Object.values(project.rows)
    .flat()
    .flatMap((b) =>
      brickPhysicalSolids(b).map((s) => {
        const shape = solidPolyhedron(s, (b.row - 1) * 70);
        return {
          id: b.id,
          shape,
          minZ: Math.min(...shape.vertices.map((p) => p.z)),
          maxZ: Math.max(...shape.vertices.map((p) => p.z)),
          metal: b.custom?.material === "steel" || ["plate", "grate", "damper", "cleanout"].includes(b.kind)
        };
      })
    );
  const cards = Array.from({ length: project.rowCount }, (_, i) => {
    const row = i + 1,
      z = i * 70 + 32.5;
    const polygons = shapes
      .filter((s) => s.minZ <= z && s.maxZ >= z)
      .map((s) => {
        const points = horizontalSection(s.shape, z);
        if (points.length < 3) return "";
        return `<polygon points="${points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ")}" fill="${s.metal ? "#627079" : "#ddaa80"}" stroke="#38281d" stroke-width="1"><title>${escapeHtml(s.id)}</title></polygon>`;
      })
      .join("");
    const hardware = (project.rows[row] ?? []).filter((b) => ["grate", "plate", "damper", "cleanout"].includes(b.kind));
    return `<article><h2>${ru ? "Ряд" : "Course"} ${row} · Z=${z} mm</h2><svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${ru ? "Горизонтальное сечение" : "Horizontal section"} ${row}" viewBox="-10 -10 ${width + 20} ${depth + 20}"><rect x="0" y="0" width="${width}" height="${depth}" fill="white" stroke="#999" stroke-width="2"/>${polygons}</svg><p>${ru ? "Начинаются в этом ряду" : "Parts starting on this course"}: ${(project.rows[row] ?? []).length}</p>${hardware.map((b) => `<p>${escapeHtml(b.custom?.name ?? b.kind)}</p>`).join("")}</article>`;
  }).join("");
  const title = ru ? "Учебная порядовка и сечения" : "Reference order and sections";
  const notice = ru
    ? "НЕ ДЛЯ КЛАДКИ. Учебная реконструкция, не утверждённый строительный проект. Тепловая мощность и тяга модели, фундамент, дымоход и привязка к дому не подтверждены."
    : "NOT FOR CONSTRUCTION. Reference reconstruction, not an approved building design. Model output, draft, foundation, chimney and site layout are unverified.";
  const explanation = ru
    ? "Показаны действительные горизонтальные сечения на середине рядов, включая клинья из предыдущих рядов. Плиты, решётки и другие детали на иных отметках перечислены у ряда начала установки и могут не пересекать плоскость рисунка. Последовательность сборки свода смотрите в 3D. Полные размеры, профили и ограничения сохранены в JSON; ведомость деталей — в CSV. Нулевая отметка рисунков — низ первого ряда, не низ фундамента. Расход деталей модели не равен закупочному количеству кирпича."
    : "These are actual horizontal mid-course sections, including wedges starting on earlier courses. Plates, grates and other parts at different heights are listed on their starting course and may not cross the drawn plane. Inspect vault assembly in 3D. JSON preserves full geometry and limitations; CSV lists parts. Drawing elevation zero is the first course, not the bottom of the foundation. Model-part count is not a brick purchase quantity.";
  return `<!doctype html><html lang="${ru ? "ru" : "en"}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font:14px system-ui,sans-serif;margin:24px;color:#241b14}h1{font-size:24px}.notice{border:2px solid #9b3818;padding:12px;font-weight:700}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}article{border:1px solid #888;padding:10px;break-inside:avoid}h2{font-size:15px}svg{width:100%;max-height:300px}p{line-height:1.5}article p{font-size:11px;margin:4px 0}@media print{body{margin:8mm}.grid{grid-template-columns:1fr 1fr}article{break-inside:avoid}a{color:inherit}header{break-after:page}}</style><header><h1>${title}: ${escapeHtml(project.title[locale])}</h1><p class="notice">${notice}</p><p>${escapeHtml(order.source.citation)} · ${escapeHtml(order.source.recipeRevision)}<br><a href="${escapeHtml(order.source.url)}">${escapeHtml(order.source.url)}</a></p><p>${explanation}</p><p>${ru ? "Пол → потолок" : "Floor → ceiling"}: ${order.input.ceilingHeightMm} mm; ${ru ? "первый ряд над полом" : "first course above floor"}: ${order.input.firstCourseAboveFloorMm} mm; ${ru ? "остаток сверху" : "top space remaining"}: ${order.assessment.actualTopGapMm} mm.</p><p>${ru ? "Нагрузка по введённым данным" : "Demand from entered data"}: ${order.assessment.heatLoss?.totalKw.toFixed(2) ?? "—"} kW. ${ru ? "Совпадение с мощностью схемы не установлено." : "A match with this layout's heat output is not established."}</p><p>${project.rowCount} ${ru ? "рядов" : "courses"}; ${order.materials.total} ${ru ? "деталей модели" : "model parts"}.</p></header><main class="grid">${cards}</main></html>`;
}
