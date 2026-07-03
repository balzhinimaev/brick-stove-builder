import { memo, useMemo, useState } from "react";
import { COLORS } from "../theme/colors";
import type { Translate } from "../i18n";
import type { BrickKind, GridSpec, NotchCorner, Orientation, PlacedBrick, SnapStep, ToolKind } from "../domain/types";
import { brickBoxes, brickSizeFor, isInsideGrid, notchBox, snapToStep } from "../domain/geometry";
import { getToolColor } from "../domain/tools";

const CELL = 34;
const PAD = 28;
const HEADER = 26;

export function PlanGrid({
  grid,
  bricks,
  activeTool,
  orientation,
  notchCorner,
  snapStep,
  placeAt,
  t
}: {
  grid: GridSpec;
  bricks: PlacedBrick[];
  activeTool: ToolKind;
  orientation: Orientation;
  notchCorner: NotchCorner;
  snapStep: SnapStep;
  placeAt: (x: number, y: number) => void;
  t: Translate;
}) {
  const width = grid.cols * CELL + PAD * 2;
  const height = grid.rows * CELL + PAD * 2 + HEADER;
  const ghost = activeTool === "eraser" ? null : brickSizeFor(activeTool, orientation);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
  const unit = t("unitCm");

  const hoverGhostFits = hoverCell && ghost ? isInsideGrid({ ...hoverCell, kind: activeTool as BrickKind, orientation }, grid) : false;
  const hoverGhostX = hoverCell ? PAD + hoverCell.x * CELL + 3 : 0;
  const hoverGhostY = hoverCell ? PAD + HEADER + hoverCell.y * CELL + 3 : 0;

  // Static grid lines, tick labels and clickable cells only change with grid size.
  const lines = useMemo(() => {
    const vertical = Array.from({ length: grid.cols + 1 }, (_, x) => (
      <line key={`vx-${x}`} x1={PAD + x * CELL} y1={PAD + HEADER} x2={PAD + x * CELL} y2={PAD + HEADER + grid.rows * CELL} stroke="rgba(61,43,31,0.28)" strokeWidth="1.3" />
    ));
    const horizontal = Array.from({ length: grid.rows + 1 }, (_, y) => (
      <line key={`hy-${y}`} x1={PAD} y1={PAD + HEADER + y * CELL} x2={PAD + grid.cols * CELL} y2={PAD + HEADER + y * CELL} stroke="rgba(61,43,31,0.28)" strokeWidth="1.3" />
    ));
    const xTicks = Array.from({ length: grid.cols + 1 }, (_, x) => (
      <text key={`xt-${x}`} x={PAD + x * CELL - 7} y={PAD + 18} fontSize="8" fontWeight="800" fill={COLORS.sageDark}>{Math.round((x * grid.widthCm) / grid.cols)}</text>
    ));
    const yTicks = Array.from({ length: grid.rows + 1 }, (_, y) => (
      <text key={`yt-${y}`} x={5} y={PAD + 30 + y * CELL} fontSize="8" fontWeight="800" fill={COLORS.sageDark}>{Math.round((y * grid.lengthCm) / grid.rows)}{unit}</text>
    ));
    return { vertical, horizontal, xTicks, yTicks };
  }, [grid, unit]);

  // Один прозрачный оверлей вместо ячеек-прямоугольников: координата клика
  // привязывается к текущему шагу (целая ячейка или полячейки).
  const cellFromEvent = (event: React.MouseEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: snapToStep((event.clientX - box.left) / CELL, snapStep, grid.cols),
      y: snapToStep((event.clientY - box.top) / CELL, snapStep, grid.rows)
    };
  };
  const overlay = (
    <rect
      x={PAD}
      y={PAD + HEADER}
      width={grid.cols * CELL}
      height={grid.rows * CELL}
      fill="transparent"
      className="cursor-pointer"
      onMouseMove={(event) => {
        const cell = cellFromEvent(event);
        setHoverCell((prev) => (prev && prev.x === cell.x && prev.y === cell.y ? prev : cell));
      }}
      onClick={(event) => {
        const cell = cellFromEvent(event);
        placeAt(cell.x, cell.y);
      }}
    />
  );

  return (
    <div className="w-full overflow-x-auto rounded-[22px] bg-[#FFF7E8]">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-label={t("ariaPlan")} onMouseLeave={() => setHoverCell(null)}>
        <rect x="1" y="1" width={width - 2} height={height - 2} rx="22" fill={COLORS.cream} stroke={COLORS.charcoal} strokeWidth="2" opacity="0.36" />
        <rect x={PAD - 2} y={PAD + 24} width={grid.cols * CELL + 4} height={grid.rows * CELL + 4} rx="14" fill="#fff6e5" stroke="#8FAF76" strokeWidth="1.5" opacity="0.75" />
        <text x="16" y="22" fontSize="12" fontWeight="900" fill={COLORS.charcoal}>{t("gridLabel")}</text>
        {lines.vertical}
        {lines.horizontal}
        {lines.xTicks}
        {lines.yTicks}
        {bricks.map((brick) => <Brick2D key={brick.id} brick={brick} cell={CELL} pad={PAD} />)}

        {hoverCell ? <rect x={PAD + hoverCell.x * CELL + 1.5} y={PAD + HEADER + hoverCell.y * CELL + 1.5} width={CELL * snapStep - 3} height={CELL * snapStep - 3} rx={snapStep === 1 ? 8 : 5} fill="rgba(143,175,118,0.18)" stroke="rgba(95,126,77,0.75)" strokeWidth="1.5" /> : null}

        {hoverCell && ghost && hoverGhostFits ? (
          <g>
            {activeTool === "grate"
              ? <Grate2D x={hoverGhostX} y={hoverGhostY} w={ghost.w * CELL - 6} h={ghost.h * CELL - 6} orientation={orientation} opacity={0.72} />
              : activeTool === "plate"
              ? <Plate2D x={hoverGhostX} y={hoverGhostY} w={ghost.w * CELL - 6} h={ghost.h * CELL - 6} orientation={orientation} opacity={0.72} />
              : activeTool === "rebate"
              ? <Rebate2D brick={{ id: "ghost", row: 0, x: hoverCell.x, y: hoverCell.y, kind: "rebate", orientation, notchCorner }} cell={CELL} pad={PAD} opacity={0.5} />
              : <rect x={hoverGhostX} y={hoverGhostY} width={ghost.w * CELL - 6} height={ghost.h * CELL - 6} rx="10" fill={getToolColor(activeTool)} opacity="0.34" stroke={COLORS.charcoal} strokeDasharray="4 4" />}
            <text x={hoverGhostX + (ghost.w * CELL - 6) / 2} y={hoverGhostY + (ghost.h * CELL - 6) / 2 + 5} textAnchor="middle" fontSize="18" fontWeight="900" fill="#2f5d38">+</text>
          </g>
        ) : null}

        {ghost && !hoverCell ? (
          activeTool === "grate"
            ? <Grate2D x={PAD + 0.2 * CELL} y={PAD + HEADER + 0.2 * CELL} w={ghost.w * CELL - 6} h={ghost.h * CELL - 6} orientation={orientation} opacity={0.45} />
            : <rect x={PAD + 0.2 * CELL} y={PAD + HEADER + 0.2 * CELL} width={ghost.w * CELL - 6} height={ghost.h * CELL - 6} rx="10" fill={getToolColor(activeTool)} opacity="0.24" stroke={COLORS.charcoal} strokeDasharray="4 4" />
        ) : null}

        {overlay}
      </svg>
    </div>
  );
}

const Brick2D = memo(function Brick2D({ brick, cell, pad }: { brick: PlacedBrick; cell: number; pad: number }) {
  const size = brickSizeFor(brick.kind, brick.orientation);
  const x = pad + brick.x * cell + 3;
  const y = pad + HEADER + brick.y * cell + 3;
  const w = size.w * cell - 6;
  const h = size.h * cell - 6;
  const fill = getToolColor(brick.kind);

  if (brick.kind === "grate") return <Grate2D x={x} y={y} w={w} h={h} orientation={brick.orientation} />;
  if (brick.kind === "rebate") return <Rebate2D brick={brick} cell={cell} pad={pad} />;
  if (brick.kind === "plate") return <Plate2D x={x} y={y} w={w} h={h} orientation={brick.orientation} />;

  return (
    <g>
      <rect x={x + 3} y={y + 4} width={w} height={h} rx="10" fill="rgba(61,43,31,0.14)" />
      <rect x={x} y={y} width={w} height={h} rx="10" fill={fill} stroke={COLORS.charcoal} strokeWidth="2" />
      <path d={`M${x + 7} ${y + h * 0.45} C${x + w * 0.35} ${y + h * 0.54}, ${x + w * 0.7} ${y + h * 0.35}, ${x + w - 7} ${y + h * 0.48}`} stroke={COLORS.mortar} strokeWidth="2" fill="none" opacity="0.7" />
      {brick.kind === "vent" && <text x={x + w / 2} y={y + h / 2 + 5} textAnchor="middle" fontSize="16" fontWeight="900" fill={COLORS.cream}>V</text>}
      {brick.kind === "cleanout" && <text x={x + w / 2} y={y + h / 2 + 5} textAnchor="middle" fontSize="16" fontWeight="900" fill={COLORS.cream}>D</text>}
    </g>
  );
});

/** Кирпич с четвертью на плане: Г-образное тело + светлая посадочная полка в вырезе. */
function Rebate2D({ brick, cell, pad, opacity = 1 }: { brick: PlacedBrick; cell: number; pad: number; opacity?: number }) {
  const toRect = (box: { x1: number; y1: number; x2: number; y2: number }, inset: number) => ({
    x: pad + box.x1 * cell + 3 + inset,
    y: pad + HEADER + box.y1 * cell + 3 + inset,
    w: (box.x2 - box.x1) * cell - 6 - inset * 2,
    h: (box.y2 - box.y1) * cell - 6 - inset * 2
  });
  const fill = getToolColor("rebate");
  const notch = notchBox(brick);
  return (
    <g opacity={opacity}>
      {brickBoxes(brick).map((box, index) => {
        const r = toRect(box, 0);
        return <rect key={index} x={r.x} y={r.y} width={r.w} height={r.h} rx="7" fill={fill} stroke={COLORS.charcoal} strokeWidth="2" />;
      })}
      {notch ? (() => {
        const r = toRect(notch, 2);
        return <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="5" fill={COLORS.cutBrick} stroke={COLORS.charcoal} strokeWidth="1" strokeDasharray="3 3" opacity="0.55" />;
      })() : null}
    </g>
  );
}

/** Варочная плита на плане: тёмная панель с двумя конфорками. */
function Plate2D({ x, y, w, h, orientation, opacity = 1 }: { x: number; y: number; w: number; h: number; orientation: Orientation; opacity?: number }) {
  const longX = orientation === "h";
  const cx1 = longX ? x + w * 0.28 : x + w / 2;
  const cy1 = longX ? y + h / 2 : y + h * 0.28;
  const cx2 = longX ? x + w * 0.72 : x + w / 2;
  const cy2 = longX ? y + h / 2 : y + h * 0.72;
  const r = Math.min(w, h) * 0.24;
  return (
    <g opacity={opacity}>
      <rect x={x + 3} y={y + 4} width={w} height={h} rx="8" fill="rgba(61,43,31,0.18)" />
      <rect x={x} y={y} width={w} height={h} rx="8" fill="#33383E" stroke={COLORS.charcoal} strokeWidth="2" />
      {[[cx1, cy1], [cx2, cy2]].map(([cx, cy], index) => (
        <g key={index}>
          <circle cx={cx} cy={cy} r={r} fill="#26292d" stroke="#1e2124" strokeWidth="2.5" />
          <circle cx={cx} cy={cy} r={r * 0.55} fill="none" stroke="#1e2124" strokeWidth="1.5" />
        </g>
      ))}
      <text x={x + w / 2} y={y + h - 7} textAnchor="middle" fontSize="11" fontWeight="900" fill="#e6d7bd">Плита</text>
    </g>
  );
}

function Grate2D({ x, y, w, h, orientation, opacity = 1 }: { x: number; y: number; w: number; h: number; orientation: Orientation; opacity?: number }) {
  const barCount = 5;
  const horizontal = orientation === "h";
  return (
    <g opacity={opacity}>
      <rect x={x + 3} y={y + 4} width={w} height={h} rx="8" fill="rgba(61,43,31,0.18)" />
      <rect x={x} y={y} width={w} height={h} rx="8" fill="#2f2f2f" stroke={COLORS.charcoal} strokeWidth="2" />
      {Array.from({ length: barCount }).map((_, i) => {
        if (horizontal) {
          const barH = (h - 10) / (barCount * 1.7);
          const gap = (h - 10 - barH * barCount) / Math.max(1, barCount - 1);
          const by = y + 5 + i * (barH + gap);
          return <rect key={i} x={x + 7} y={by} width={w - 14} height={barH} rx="3" fill="#555" />;
        }
        const barW = (w - 10) / (barCount * 1.7);
        const gap = (w - 10 - barW * barCount) / Math.max(1, barCount - 1);
        const bx = x + 5 + i * (barW + gap);
        return <rect key={i} x={bx} y={y + 7} width={barW} height={h - 14} rx="3" fill="#555" />;
      })}
      <text x={x + w / 2} y={y + h / 2 + 5} textAnchor="middle" fontSize="13" fontWeight="900" fill="#e6d7bd">РУ</text>
    </g>
  );
}
