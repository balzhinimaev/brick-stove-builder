import { createPortal } from "react-dom";
import type { Translate } from "../i18n";
import type { GridSpec, MaterialsEstimate, Parameters, PlacedBrick } from "../domain/types";
import { ExactSection } from "./ExactSection";
import { partNumbers } from "../domain/masonrySections";
import { masonryDimensions } from "../domain/masonryAudit";
import { MaterialsSummary } from "./MaterialsSummary";

/**
 * Print-only sheet with the full stove order: one plan per row plus the
 * materials estimate. Rendered through a portal next to #root so that
 * `window.print()` shows just this sheet (see the inline @media print rules).
 */
export function PrintOrder({
  t,
  grid,
  rows,
  rowCount,
  lockedRows,
  parameters,
  materials,
  title,
  revision,
  onlyRow
}: {
  title?: string;
  revision?: number;
  onlyRow?: number;
  t: Translate;
  grid: GridSpec;
  rows: Record<number, PlacedBrick[]>;
  rowCount: number;
  lockedRows: number[];
  parameters: Parameters;
  materials: MaterialsEstimate;
}) {
  const unit = t("unitCm");
  const all = Object.values(rows).flat();
  const numbers = partNumbers(all);
  return createPortal(
    <div className="print-order">
      <style>{`
        .print-order { display: none; }
        @media print {
          #root { display: none !important; }
          .print-order { display: block; font-family: system-ui, sans-serif; color: #1a1a1a; }
          .print-order .row-card { break-before: page; }
          .print-order .exact-section svg { width: 100%; max-height: 135mm; }
          .print-order table { width:100%; border-collapse:collapse; font-size:9pt; }
          .print-order td, .print-order th { border:1px solid #bbb; padding:3px; }
          .print-order tr { break-inside:avoid; }
        }
      `}</style>
      <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>
        {title ?? t("appTitle")} — {t("printOrderTitle")} · рев. {revision ?? 1}
      </h1>
      <p style={{ fontSize: 12, margin: "0 0 12px", color: "#555" }}>
        {t("projectFootprint")}: {parameters.foundationWidth}×{parameters.foundationLength} {unit} · {rowCount}{" "}
        {t("projectRows")} · {t("totalPlaced")}: {materials.total}
      </p>

      {Object.values(rows).some((r) => r.some((b) => b.id.startsWith("rp54-"))) && (
        <p style={{ border: "2px solid #8b4e35", padding: 8 }}>
          РП54 — проектная модель, не разрешение на кладку. Корпус до 29-го ряда, верх 2,025 м; ряды 30–89 — коренная
          труба. Нагретая прочность, тяга и теплоотдача не подтверждены. Дом и подземное основание показаны отдельной
          схемой и не входят в ведомость кирпичей; бетон в стандартной ведомости учитывает только верхнюю плиту.
        </p>
      )}
      <div>
        {(onlyRow ? [onlyRow] : Array.from({ length: rowCount }, (_, i) => i + 1)).map((row) => {
          const bricks = rows[row] ?? [];
          return (
            <div key={row} className="row-card" style={{ border: "1px solid #bbb", borderRadius: 8, padding: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                {t("currentRow")} {row}
                {lockedRows.includes(row) ? " ✓" : ""} · {bricks.length}
              </div>
              <p>
                Точное сечение Z = {(row - 1) * 70 + 32.5} мм. Масштаб задаётся основанием {grid.cols * 125} ×{" "}
                {grid.rows * 125} мм. Детали из нижних рядов включены.
              </p>
              <ExactSection grid={grid} bricks={all} row={row} numbers />
              <p>Установка в этом ряду (габариты в мм; номера совпадают с редактором):</p>
              <table>
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Деталь</th>
                    <th>X × Y × Z, мм</th>
                    <th>Форма</th>
                  </tr>
                </thead>
                <tbody>
                  {bricks.map((b) => (
                    <tr key={b.id}>
                      <td>{numbers.get(b.id)}</td>
                      <td>{b.custom?.name ?? b.kind}</td>
                      <td>
                        {masonryDimensions(b)
                          .map((n) => n.toFixed(1))
                          .join(" × ")}
                      </td>
                      <td>
                        {b.custom?.solidParts
                          ? "Составной вырез · одна заготовка"
                          : b.custom?.profileXZ
                            ? "Профильная"
                            : "Прямая / арматура"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      <section className="row-card">
        <MaterialsSummary materials={materials} t={t} />
        <p>
          Ведомость относится ко всему проекту. Сечения и габариты — геометрические данные, не оптимизированная карта
          раскроя с пропилом.
        </p>
      </section>
    </div>,
    document.body
  );
}
