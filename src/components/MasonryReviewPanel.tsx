import { sectionsAtHeight, partNumbers } from "../domain/masonrySections";
import { useMemo, useState } from "react";
import { brickPhysicalSolids } from "../domain/geometry";
import {
  isMasonryPiece,
  auditMasonry,
  type MasonryIssue,
  mmLabel,
  masonryCsv,
  masonryDimensions
} from "../domain/masonryAudit";
import { THIN_PART_MM } from "../domain/masonryLayout";
import type { GridSpec, PlacedBrick } from "../domain/types";

const labels: Record<MasonryIssue["kind"], string> = {
  thin: "Тонкая деталь",
  "cut-detail": "Тонкий участок выреза",
  stock: "Не помещается в заготовку",
  bond: "Совпадение швов"
};
export function MasonryReviewPanel({
  bricks,
  grid,
  currentRow,
  selectedIds,
  onSelect,
  onClear
}: {
  bricks: PlacedBrick[];
  grid: GridSpec;
  currentRow: number;
  selectedIds: string[];
  onSelect: (ids: string[], row: number) => void;
  onClear: () => void;
}) {
  const audit = useMemo(() => auditMasonry(bricks), [bricks]);
  const [filter, setFilter] = useState<"all" | MasonryIssue["kind"]>("all");
  const [limit, setLimit] = useState(12);
  const [offset, setOffset] = useState(32.5);
  const [zoom, setZoom] = useState(true);
  const [scope, setScope] = useState<"all" | "row" | "selected">("all");
  const issues = audit.issues.filter(
    (i) =>
      (filter === "all" || i.kind === filter) &&
      (scope === "all" || (scope === "row" ? i.row === currentRow : i.ids.some((id) => selectedIds.includes(id))))
  );
  const selected = new Set(selectedIds);
  const issueIds = new Set(audit.issues.filter((i) => i.kind !== "bond").flatMap((i) => i.ids));
  const z = (currentRow - 1) * 70 + offset;
  const sections = useMemo(() => sectionsAtHeight(bricks, z), [bricks, z]);
  const numbers = useMemo(() => partNumbers(bricks), [bricks]);
  const pick = (ids: string[], row: number) => {
    const brick = bricks.find((b) => b.id === ids[0]);
    const solid = brick && brickPhysicalSolids(brick)[0];
    const absoluteZ = brick && solid ? (brick.row - 1) * 70 + (solid.z1 + solid.z2) / 2 : (row - 1) * 70 + 32.5;
    const sectionRow = Math.floor(absoluteZ / 70) + 1;
    setOffset(Math.min(64.9, Math.max(0.1, absoluteZ - (sectionRow - 1) * 70)));
    onSelect(ids, sectionRow);
  };
  const selectedSolids = bricks.filter((b) => selected.has(b.id)).flatMap((b) => brickPhysicalSolids(b));
  let viewBox = `0 0 ${grid.cols * 125} ${grid.rows * 125}`;
  if (zoom && selectedSolids.length) {
    const x1 = Math.min(...selectedSolids.map((s) => s.box.x1)) * 125 - 100;
    const y1 = Math.min(...selectedSolids.map((s) => s.box.y1)) * 125 - 100;
    const x2 = Math.max(...selectedSolids.map((s) => s.box.x2)) * 125 + 100;
    const y2 = Math.max(...selectedSolids.map((s) => s.box.y2)) * 125 + 100;
    viewBox = `${x1} ${y1} ${x2 - x1} ${y2 - y1}`;
  }
  const download = (format: "csv" | "json") => {
    // Exact geometry accompanies the IDs; this is a part schedule, not an
    // assertion that each model fragment consumes a purchased full brick.
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format: "masonry-part-schedule-v1",
            units: { planCellMm: 125, profiles: "mm", solidParts: "mm" },
            stock: [250, 120, 65],
            note: "Ведомость геометрии. Не закупочная смета и не подтверждение готовности к кладке. Координаты x/y и w/h в документе: ячейки по 125 мм; solidParts и profileXZ: мм.",
            summary: { total: audit.total, full: audit.full, rectangular: audit.rectangular, shaped: audit.shaped },
            issues: audit.issues,
            parts: bricks.filter(isMasonryPiece)
          },
          null,
          2
        )
      ],
      { type: "application/json" }
    );
    const file = format === "csv" ? new Blob([masonryCsv(bricks)], { type: "text/csv;charset=utf-8" }) : blob;
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = `masonry-parts.${format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <details className="masonry-review" open>
      <summary>
        <span>Раскладка и подрезки</span>
        <span className="masonry-review-badge">
          {audit.full} целых · {audit.issues.length} замечаний
        </span>
      </summary>
      <div className="masonry-review-body">
        <div className="masonry-metrics">
          <div>
            <strong>{audit.full}</strong>
            <span>целых кирпичей</span>
          </div>
          <div>
            <strong>{audit.rectangular}</strong>
            <span>прямых подрезок</span>
          </div>
          <div>
            <strong>{audit.shaped}</strong>
            <span>фасонных деталей</span>
          </div>
          <div>
            <strong>{audit.total}</strong>
            <span>кирпичных деталей</span>
          </div>
        </div>
        <p className="masonry-caption">
          Одна деталь с вырезами — один кирпич. Порог {THIN_PART_MM} мм служит для проверки, а не заменяет строительные
          требования. Совпадение швов — повод проверить перевязку, не расчёт прочности.
        </p>
        <div className="masonry-review-grid">
          <div className="masonry-section">
            <header>
              <strong>Ряд {currentRow} · сечение</strong>
              <span>Z = {mmLabel(z)} мм</span>
            </header>
            <svg viewBox={viewBox} aria-label={`Сечение кладки ряда ${currentRow}`}>
              <title>Сечение кладки ряда {currentRow}</title>
              {sections.map(({ brick, path, outline }) => (
                // biome-ignore lint/a11y/useSemanticElements: SVG groups cannot contain HTML buttons; retain keyboard activation and button semantics.
                <g
                  key={brick.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${brick.custom?.name ?? brick.kind}, ${brick.id}`}
                  aria-pressed={selected.has(brick.id)}
                  onClick={() => pick([brick.id], brick.row)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      pick([brick.id], brick.row);
                    }
                  }}
                >
                  <title>
                    {brick.id} · {brick.custom?.name ?? brick.kind}
                  </title>
                  <path
                    d={path}
                    fill={
                      selected.has(brick.id)
                        ? "#167e89"
                        : issueIds.has(brick.id)
                          ? "#d85a34"
                          : brick.custom?.material === "steel" || brick.kind !== "custom"
                            ? "#71808b"
                            : "#dbb88d"
                    }
                  />
                  <path
                    d={outline}
                    fill="none"
                    stroke={selected.has(brick.id) ? "#073e45" : "#69513c"}
                    strokeWidth={selected.has(brick.id) ? 5 : 1.2}
                  />
                </g>
              ))}
            </svg>
            <label>
              Высота сечения в ряду{" "}
              <input
                type="range"
                min="0.1"
                max="64.9"
                step="0.1"
                value={offset}
                onChange={(e) => setOffset(Number(e.target.value))}
              />
            </label>
            <p className="masonry-caption">
              Красный — требует проверки · бирюзовый — выбранная деталь. Сечение учитывает своды из нижних рядов.
            </p>
            {selectedIds.length > 0 && (
              <div className="masonry-selection">
                <strong>{selectedIds.join(", ")}</strong>
                <button type="button" onClick={() => setZoom(!zoom)}>
                  {zoom ? "Весь ряд" : "Крупно"}
                </button>
                {selectedIds.length === 1 &&
                  bricks
                    .filter((b) => selected.has(b.id))
                    .map((b) => (
                      <span key={b.id}>
                        {masonryDimensions(b).map(mmLabel).join(" × ")} мм ·{" "}
                        {b.custom?.solidParts ? "Один кирпич с вырезами" : b.custom?.name}
                      </span>
                    ))}
                <button
                  type="button"
                  onClick={() =>
                    document.querySelector(".studio-viewport")?.scrollIntoView({ behavior: "smooth", block: "center" })
                  }
                >
                  Показать в 3D
                </button>
                <button type="button" onClick={onClear}>
                  Снять выделение
                </button>
              </div>
            )}
          </div>
          <div className="masonry-issues">
            <label>
              Область{" "}
              <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
                <option value="all">Вся печь</option>
                <option value="row">Текущий ряд</option>
                <option value="selected">Выбранная деталь</option>
              </select>
            </label>
            <label>
              Проверка{" "}
              <select
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value as typeof filter);
                  setLimit(12);
                }}
              >
                <option value="all">Все замечания ({audit.issues.length})</option>
                {Object.entries(labels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label} ({audit.issues.filter((i) => i.kind === key).length})
                  </option>
                ))}
              </select>
            </label>
            {issues.length === 0 && <p className="masonry-empty">По этой проверке замечаний нет.</p>}
            <ol>
              {issues.slice(0, limit).map((issue) => (
                <li key={issue.key}>
                  <button
                    type="button"
                    aria-pressed={issue.ids.some((id) => selected.has(id))}
                    onClick={() => pick(issue.ids, issue.row)}
                  >
                    <span className="masonry-row">{issue.row}</span>
                    <span>
                      <strong>{labels[issue.kind]}</strong>
                      <small>
                        {issue.dimensions.length
                          ? `${issue.dimensions.map(mmLabel).join(" × ")} мм`
                          : `Ряды ${issue.row - 1}–${issue.row} · совпадение ${mmLabel(issue.value)} мм`}
                      </small>
                      {issue.kind === "cut-detail" && (
                        <small>Участок {mmLabel(issue.value)} мм внутри одного кирпича</small>
                      )}
                      <small>Деталь № {numbers.get(issue.ids[0])} · для осмотра</small>
                    </span>
                    <span aria-hidden="true">↗</span>
                  </button>
                </li>
              ))}
            </ol>
            {issues.length > limit && (
              <button className="masonry-more" type="button" onClick={() => setLimit(limit + 24)}>
                Показать ещё · осталось {issues.length - limit}
              </button>
            )}
          </div>
        </div>
        <footer>
          <span>Данные пересчитываются по текущему проекту, включая ваши изменения.</span>
          <div className="masonry-downloads">
            <button type="button" onClick={() => download("csv")}>
              Ведомость CSV
            </button>
            <button type="button" onClick={() => download("json")}>
              Геометрия JSON
            </button>
          </div>
        </footer>
      </div>
    </details>
  );
}
