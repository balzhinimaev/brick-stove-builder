import { createPortal } from "react-dom";
import type { Translate } from "../i18n";
import type { GridSpec, MaterialsEstimate, Parameters, PlacedBrick } from "../domain/types";
import { brickBoxes, isOverlayKind } from "../domain/geometry";
import { getToolColor } from "../domain/tools";

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
      <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>{t("appTitle")} — {t("printOrderTitle")}</h1>
      <p style={{ fontSize: 12, margin: "0 0 12px", color: "#555" }}>
        {t("projectFootprint")}: {parameters.foundationWidth}×{parameters.foundationLength} {unit} ·{" "}
        {rowCount} {t("projectRows")} · {t("totalPlaced")}: {materials.total}
      </p>

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
              <PrintRowMap grid={grid} bricks={bricks} />
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
            [t("mortarEstimate"), `${materials.mortarM3} м³`],
            [t("foundationConcrete"), `${materials.concreteVolumeM3} м³`]
          ].map(([label, value]) => (
            <tr key={String(label)}>
              <td style={{ border: "1px solid #bbb", padding: "3px 10px" }}>{label}</td>
              <td style={{ border: "1px solid #bbb", padding: "3px 10px", textAlign: "right", fontWeight: 700 }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>,
    document.body
  );
}

function PrintRowMap({ grid, bricks }: { grid: GridSpec; bricks: PlacedBrick[] }) {
  const cell = Math.min(18, 220 / Math.max(grid.cols, grid.rows));
  const width = grid.cols * cell + 2;
  const height = grid.rows * cell + 2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect x="0.5" y="0.5" width={width - 1} height={height - 1} fill="#fff" stroke="#888" strokeWidth="1" />
      {Array.from({ length: grid.cols + 1 }).map((_, x) => (
        <line key={`x${x}`} x1={1 + x * cell} y1={1} x2={1 + x * cell} y2={1 + grid.rows * cell} stroke="#ddd" strokeWidth="0.6" />
      ))}
      {Array.from({ length: grid.rows + 1 }).map((_, y) => (
        <line key={`y${y}`} x1={1} y1={1 + y * cell} x2={1 + grid.cols * cell} y2={1 + y * cell} stroke="#ddd" strokeWidth="0.6" />
      ))}
      {[...bricks].sort((a, b) => Number(isOverlayKind(a.kind)) - Number(isOverlayKind(b.kind))).flatMap((brick) =>
        brickBoxes(brick).map((box, index) => (
          <rect
            key={`${brick.id}-${index}`}
            x={1 + box.x1 * cell + 0.8}
            y={1 + box.y1 * cell + 0.8}
            width={(box.x2 - box.x1) * cell - 1.6}
            height={(box.y2 - box.y1) * cell - 1.6}
            rx="2"
            fill={getToolColor(brick.kind)}
            stroke="#333"
            strokeWidth="0.8"
          />
        ))
      )}
    </svg>
  );
}
