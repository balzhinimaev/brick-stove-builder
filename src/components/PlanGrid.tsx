import { memo, useMemo, useState } from "react";
import { COLORS } from "../theme/colors";
import type { Translate } from "../i18n";
import type { BrickKind, CustomBrickSpec, GridSpec, NotchCorner, Orientation, PlacedBrick, SnapStep, ToolKind } from "../domain/types";
import { brickBounds, footprintSizeOf, isInsideGrid, isOverlayKind, notchBox, snapToStep } from "../domain/geometry";
import { notchedShape } from "../domain/outline";
import { plateBurnerCenters } from "../domain/plate";
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
  customBrick,
  plateSpec,
  doorSpec,
  placeAt,
  t
}: {
  grid: GridSpec;
  bricks: PlacedBrick[];
  activeTool: ToolKind;
  orientation: Orientation;
  notchCorner: NotchCorner;
  snapStep: SnapStep;
  customBrick: CustomBrickSpec | null;
  plateSpec: CustomBrickSpec;
  doorSpec: CustomBrickSpec;
  placeAt: (x: number, y: number, exactX?: number, exactY?: number) => void;
  t: Translate;
}) {
  const width = grid.cols * CELL + PAD * 2;
  const height = grid.rows * CELL + PAD * 2 + HEADER;
  const ghostCustom = activeTool === "plate" ? plateSpec : activeTool === "cleanout" ? doorSpec : activeTool === "custom" ? customBrick : null;
  const ghost = activeTool === "eraser" || (activeTool === "custom" && !customBrick)
    ? null
    : footprintSizeOf({ x: 0, y: 0, kind: activeTool as BrickKind, orientation, custom: ghostCustom ?? undefined });
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
  const unit = t("unitCm");

  const hoverGhostFits = hoverCell && ghost ? isInsideGrid({ ...hoverCell, kind: activeTool as BrickKind, orientation, custom: ghostCustom ?? undefined }, grid) : false;
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
    const rawX = (event.clientX - box.left) / CELL;
    const rawY = (event.clientY - box.top) / CELL;
    return {
      x: snapToStep(rawX, snapStep, grid.cols),
      y: snapToStep(rawY, snapStep, grid.rows),
      rawX,
      rawY
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
        placeAt(cell.x, cell.y, cell.rawX, cell.rawY);
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
        {/* накладные элементы (плита) рисуются последними — они лежат поверх кладки */}
        {[...bricks].sort((a, b) => Number(isOverlayKind(a.kind)) - Number(isOverlayKind(b.kind))).map((brick) => <Brick2D key={brick.id} brick={brick} cell={CELL} pad={PAD} />)}

        {hoverCell ? <rect x={PAD + hoverCell.x * CELL + 1.5} y={PAD + HEADER + hoverCell.y * CELL + 1.5} width={CELL * snapStep - 3} height={CELL * snapStep - 3} rx={snapStep === 1 ? 8 : 5} fill="rgba(143,175,118,0.18)" stroke="rgba(95,126,77,0.75)" strokeWidth="1.5" /> : null}

        {hoverCell && ghost && hoverGhostFits ? (
          <g>
            {activeTool === "grate"
              ? <Grate2D x={hoverGhostX} y={hoverGhostY} w={ghost.w * CELL - 6} h={ghost.h * CELL - 6} orientation={orientation} opacity={0.72} />
              : activeTool === "plate"
              ? <Plate2D x={hoverGhostX} y={hoverGhostY} w={ghost.w * CELL - 6} h={ghost.h * CELL - 6} burners={plateBurnerCenters(ghost.w, ghost.h)} opacity={0.72} />
              : activeTool === "rebate"
              ? <Rebate2D brick={{ id: "ghost", row: 0, x: hoverCell.x, y: hoverCell.y, kind: "rebate", orientation, notchCorner }} cell={CELL} pad={PAD} opacity={0.5} />
              : activeTool === "custom" && customBrick?.notch
              ? <Rebate2D brick={{ id: "ghost", row: 0, x: hoverCell.x, y: hoverCell.y, kind: "custom", orientation, custom: customBrick }} cell={CELL} pad={PAD} opacity={0.5} />
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
  const size = footprintSizeOf(brick);
  const x = pad + brick.x * cell + 3;
  const y = pad + HEADER + brick.y * cell + 3;
  const w = size.w * cell - 6;
  const h = size.h * cell - 6;
  const fill = getToolColor(brick.kind);

  if (brick.kind === "grate") return <Grate2D x={x} y={y} w={w} h={h} orientation={brick.orientation} />;
  if (brick.kind === "rebate" || (brick.kind === "custom" && brick.custom?.notch)) return <Rebate2D brick={brick} cell={cell} pad={pad} />;
  if (brick.kind === "plate") return <Plate2D x={x} y={y} w={w} h={h} burners={plateBurnerCenters(size.w, size.h)} />;

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

/**
 * Кирпич с четвертью на плане: ОДИН контур с явно вырезанным углом (или узкое
 * тело при пазе вдоль грани) + бледная ступень-полка внутри выреза.
 */
function Rebate2D({ brick, cell, pad, opacity = 1 }: { brick: PlacedBrick; cell: number; pad: number; opacity?: number }) {
  const b = brickBounds(brick);
  const notch = notchBox(brick)!;
  const inset = 3;
  const px = (v: number) => pad + v * cell;
  const py = (v: number) => pad + HEADER + v * cell;
  const EPS = 1e-6;
  // внешние грани ужимаем как у обычных кирпичей; линии среза оставляем точными
  const mapX = (v: number) => (Math.abs(v - b.x1) < EPS ? px(b.x1) + inset : Math.abs(v - b.x2) < EPS ? px(b.x2) - inset : px(v));
  const mapY = (v: number) => (Math.abs(v - b.y1) < EPS ? py(b.y1) + inset : Math.abs(v - b.y2) < EPS ? py(b.y2) - inset : py(v));

  // контур тела «габарит минус вырез» — общий polygon-builder (domain/outline),
  // считаем в ячейках сетки и уже потом переводим точки в px с ужимкой граней
  const shape = notchedShape(b, notch, EPS);
  const nx1 = mapX(notch.x1);
  const nx2 = mapX(notch.x2);
  const ny1 = mapY(notch.y1);
  const ny2 = mapY(notch.y2);

  const fill = getToolColor(brick.kind);
  return (
    <g opacity={opacity}>
      {shape.kind === "polygon" ? (
        <path d={`M${shape.points.map(([x, y]) => `${mapX(x)} ${mapY(y)}`).join(" L")} Z`} fill={fill} stroke={COLORS.charcoal} strokeWidth="2" strokeLinejoin="round" />
      ) : (
        // паз вдоль грани: тело — прямоугольник, «отрезанный» по линии паза
        <rect x={mapX(shape.rect.x1)} y={mapY(shape.rect.y1)} width={mapX(shape.rect.x2) - mapX(shape.rect.x1)} height={mapY(shape.rect.y2) - mapY(shape.rect.y1)} rx="7" fill={fill} stroke={COLORS.charcoal} strokeWidth="2" />
      )}
      {/* ступень-полка внутри выреза: бледная, чтобы вырез читался как вырез */}
      {brick.kind !== "custom" || brick.custom?.ledge !== false ? (
        <rect x={nx1 + 1.5} y={ny1 + 1.5} width={nx2 - nx1 - 3} height={ny2 - ny1 - 3} fill={COLORS.cutBrick} opacity="0.3" stroke={COLORS.charcoal} strokeWidth="1" strokeDasharray="3 3" />
      ) : null}
    </g>
  );
}

/** Варочная плита на плане: тёмная панель; конфорки — доли размера из domain/plate. */
function Plate2D({ x, y, w, h, burners, opacity = 1 }: { x: number; y: number; w: number; h: number; burners: Array<[number, number]>; opacity?: number }) {
  const centers: Array<[number, number]> = burners.map(([fx, fy]) => [x + w * fx, y + h * fy]);
  const r = Math.min(w, h) * 0.24;
  return (
    <g opacity={opacity}>
      <rect x={x + 3} y={y + 4} width={w} height={h} rx="8" fill="rgba(61,43,31,0.18)" />
      <rect x={x} y={y} width={w} height={h} rx="8" fill="#33383E" stroke={COLORS.charcoal} strokeWidth="2" />
      {centers.map(([cx, cy], index) => (
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
