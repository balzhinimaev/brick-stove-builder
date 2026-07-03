import { COLORS } from "../theme/colors";
import type { GridSpec, PlacedBrick } from "../domain/types";
import { brickBoxes, isOverlayKind } from "../domain/geometry";
import { getToolColor } from "../domain/tools";

/**
 * Мини-карта одного ряда кладки: сетка + занятые боксы кирпичей.
 * Варианты оформления: "print" — печатная смета, "screen" — карточки проектов.
 */
type RowMapStyle = {
  maxCell: number;
  maxSpan: number;
  pad: number;
  frame: { inset: number; rx: number; fill: string; stroke: string; strokeWidth: number; opacity?: number };
  gridLine: { stroke: string; strokeWidth: number };
  brick: { inset: number; rx: number; stroke: string; strokeWidth: number };
  className?: string;
};

const STYLES: Record<"print" | "screen", RowMapStyle> = {
  print: {
    maxCell: 18,
    maxSpan: 220,
    pad: 1,
    frame: { inset: 0.5, rx: 0, fill: "#fff", stroke: "#888", strokeWidth: 1 },
    gridLine: { stroke: "#ddd", strokeWidth: 0.6 },
    brick: { inset: 0.8, rx: 2, stroke: "#333", strokeWidth: 0.8 }
  },
  screen: {
    maxCell: 10,
    maxSpan: 112,
    pad: 9,
    frame: { inset: 1, rx: 12, fill: COLORS.cream, stroke: COLORS.charcoal, strokeWidth: 1.5, opacity: 0.26 },
    gridLine: { stroke: COLORS.gridLine, strokeWidth: 0.8 },
    brick: { inset: 1, rx: 3, stroke: COLORS.charcoal, strokeWidth: 0.8 },
    className: "mx-auto block"
  }
};

export function RowMap({ grid, bricks, variant }: { grid: GridSpec; bricks: PlacedBrick[]; variant: "print" | "screen" }) {
  const s = STYLES[variant];
  const cell = Math.min(s.maxCell, s.maxSpan / Math.max(grid.cols, grid.rows));
  const width = grid.cols * cell + s.pad * 2;
  const height = grid.rows * cell + s.pad * 2;
  return (
    <svg className={s.className} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect
        x={s.frame.inset}
        y={s.frame.inset}
        width={width - s.frame.inset * 2}
        height={height - s.frame.inset * 2}
        rx={s.frame.rx}
        fill={s.frame.fill}
        stroke={s.frame.stroke}
        strokeWidth={s.frame.strokeWidth}
        opacity={s.frame.opacity}
      />
      {Array.from({ length: grid.cols + 1 }).map((_, x) => (
        <line key={`rmx-${x}`} x1={s.pad + x * cell} y1={s.pad} x2={s.pad + x * cell} y2={s.pad + grid.rows * cell} stroke={s.gridLine.stroke} strokeWidth={s.gridLine.strokeWidth} />
      ))}
      {Array.from({ length: grid.rows + 1 }).map((_, y) => (
        <line key={`rmy-${y}`} x1={s.pad} y1={s.pad + y * cell} x2={s.pad + grid.cols * cell} y2={s.pad + y * cell} stroke={s.gridLine.stroke} strokeWidth={s.gridLine.strokeWidth} />
      ))}
      {/* накладные элементы (плита) рисуются последними — поверх кладки */}
      {[...bricks].sort((a, b) => Number(isOverlayKind(a.kind)) - Number(isOverlayKind(b.kind))).flatMap((brick) =>
        brickBoxes(brick).map((box, index) => (
          <rect
            key={`${brick.id}-${index}`}
            x={s.pad + box.x1 * cell + s.brick.inset}
            y={s.pad + box.y1 * cell + s.brick.inset}
            width={(box.x2 - box.x1) * cell - s.brick.inset * 2}
            height={(box.y2 - box.y1) * cell - s.brick.inset * 2}
            rx={s.brick.rx}
            fill={getToolColor(brick.kind)}
            stroke={s.brick.stroke}
            strokeWidth={s.brick.strokeWidth}
          />
        ))
      )}
    </svg>
  );
}
