import { type BrickBox, brickBoxes, isOverlayKind, notchBox } from "../domain/geometry";
import { isSteelPart } from "../domain/materials";
import { getToolColor } from "../domain/tools";
import type { GridSpec, PlacedBrick } from "../domain/types";
import { COLORS } from "../theme/colors";

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

function mapRect(box: BrickBox, cell: number, style: RowMapStyle, strokeWidth = style.brick.strokeWidth) {
  const width = (box.x2 - box.x1) * cell;
  const height = (box.y2 - box.y1) * cell;
  // Thin steel and masonry cuts can be subpixel-sized. Keep at least half of
  // each real span filled, and keep the centered outline inside its footprint.
  const insetX = Math.min(style.brick.inset, width / 4);
  const insetY = Math.min(style.brick.inset, height / 4);
  return {
    x: style.pad + box.x1 * cell + insetX,
    y: style.pad + box.y1 * cell + insetY,
    width: width - insetX * 2,
    height: height - insetY * 2,
    rx: Math.min(style.brick.rx, (width - insetX * 2) / 2, (height - insetY * 2) / 2),
    strokeWidth: Math.min(strokeWidth, insetX * 2, insetY * 2)
  };
}

export function RowMap({
  grid,
  bricks,
  variant
}: {
  grid: GridSpec;
  bricks: PlacedBrick[];
  variant: "print" | "screen";
}) {
  const s = STYLES[variant];
  const cell = Math.min(s.maxCell, s.maxSpan / Math.max(grid.cols, grid.rows));
  const width = grid.cols * cell + s.pad * 2;
  const height = grid.rows * cell + s.pad * 2;
  return (
    <svg className={s.className} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <title>Stove row layout</title>
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
      {Array.from({ length: grid.cols + 1 }, (_, x) => x).map((x) => (
        <line
          key={`rmx-${x}`}
          x1={s.pad + x * cell}
          y1={s.pad}
          x2={s.pad + x * cell}
          y2={s.pad + grid.rows * cell}
          stroke={s.gridLine.stroke}
          strokeWidth={s.gridLine.strokeWidth}
        />
      ))}
      {Array.from({ length: grid.rows + 1 }, (_, y) => y).map((y) => (
        <line
          key={`rmy-${y}`}
          x1={s.pad}
          y1={s.pad + y * cell}
          x2={s.pad + grid.cols * cell}
          y2={s.pad + y * cell}
          stroke={s.gridLine.stroke}
          strokeWidth={s.gridLine.strokeWidth}
        />
      ))}
      {/* накладные элементы (плита, задвижка) рисуются последними — поверх кладки */}
      {[...bricks]
        .sort((a, b) => Number(isOverlayKind(a.kind)) - Number(isOverlayKind(b.kind)))
        .flatMap((brick) => {
          // автоподрез из шамота остаётся шамотного цвета
          const fill = isSteelPart(brick)
            ? "#535c62"
            : brick.custom?.cutFrom === "firebrick"
              ? COLORS.firebrick
              : getToolColor(brick.kind);
          const body = brickBoxes(brick).map((box) => (
            <rect
              key={`${brick.id}-${box.x1}-${box.y1}-${box.x2}-${box.y2}`}
              {...mapRect(box, cell, s)}
              fill={fill}
              stroke={s.brick.stroke}
            />
          ));
          // полка выреза (в т.ч. полностью срезанный кирпич, у которого тела нет) —
          // бледным, чтобы печник видел посадочные места на печати и карточках
          const notch = notchBox(brick);
          const ledge =
            notch && brick.custom?.ledge !== false ? (
              <rect
                key={`${brick.id}-ledge`}
                {...mapRect(notch, cell, s, s.brick.strokeWidth * 0.8)}
                fill={fill}
                opacity={0.38}
                stroke={s.brick.stroke}
                strokeDasharray="3 2"
              />
            ) : null;
          return ledge ? [ledge, ...body] : body;
        })}
    </svg>
  );
}
