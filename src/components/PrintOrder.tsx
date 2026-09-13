import { createPortal } from "react-dom";
import type { Translate } from "../i18n";
import type { GridSpec, MaterialsEstimate, Parameters, PlacedBrick } from "../domain/types";
import { RowMap } from "./RowMap";
import { formatM3 } from "./format";

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
  materials
}: {
  t: Translate;
  grid: GridSpec;
  rows: Record<number, PlacedBrick[]>;
  rowCount: number;
  lockedRows: number[];
  parameters: Parameters;
  materials: MaterialsEstimate;
}) {
  const unit = t("unitCm");
  return createPortal(
    <div className="print-order">
      <style>{`
        .print-order { display: none; }
        @media print {
          #root { display: none !important; }
          .print-order { display: block; font-family: system-ui, sans-serif; color: #1a1a1a; }
          .print-order .row-card { break-inside: avoid; }
        }
      `}</style>
      <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>
        {t("appTitle")} — {t("printOrderTitle")}
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
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {Array.from({ length: rowCount }).map((_, index) => {
          const row = index + 1;
          const bricks = rows[row] ?? [];
          return (
            <div key={row} className="row-card" style={{ border: "1px solid #bbb", borderRadius: 8, padding: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                {t("currentRow")} {row}
                {lockedRows.includes(row) ? " ✓" : ""} · {bricks.length}
              </div>
              <RowMap grid={grid} bricks={bricks} variant="print" />
            </div>
          );
        })}
      </div>

      <h2 style={{ fontSize: 15, margin: "16px 0 6px" }}>{t("materialsSnapshot")}</h2>
      <table style={{ fontSize: 12, borderCollapse: "collapse" }}>
        <tbody>
          {[
            [t("regularBricks"), materials.regularBricks],
            [t("cutBricks"), materials.cutBricks],
            [t("rebatedBricks"), materials.rebatedBricks],
            [t("firebricks"), materials.firebricks],
            [t("grates"), materials.grates],
            [t("plates"), materials.plates],
            [t("doors"), materials.doors],
            [t("dampers"), materials.dampers],
            [t("vents"), materials.vents],
            ...((materials.steelKg ?? 0) > 0 ? [[t("steelApproxKg"), (materials.steelKg ?? 0).toFixed(2)]] : []),
            [t("mortarEstimate"), formatM3(materials.mortarM3)],
            [t("foundationConcrete"), formatM3(materials.concreteVolumeM3)]
          ].map(([label, value]) => (
            <tr key={String(label)}>
              <td style={{ border: "1px solid #bbb", padding: "3px 10px" }}>{label}</td>
              <td style={{ border: "1px solid #bbb", padding: "3px 10px", textAlign: "right", fontWeight: 700 }}>
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>,
    document.body
  );
}
