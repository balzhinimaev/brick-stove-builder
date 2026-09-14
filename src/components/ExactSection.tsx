import { useMemo, useState } from "react";
import { partNumbers, sectionsAtHeight } from "../domain/masonrySections";
import type { GridSpec, PlacedBrick } from "../domain/types";

export function ExactSection({
  bricks,
  grid,
  row,
  offset = 32.5,
  selectedIds = [],
  onSelect,
  previous = false,
  numbers = false,
  measurement = false
}: {
  bricks: PlacedBrick[];
  grid: GridSpec;
  row: number;
  offset?: number;
  selectedIds?: string[];
  onSelect?: (ids: string[], row: number) => void;
  previous?: boolean;
  numbers?: boolean;
  measurement?: boolean;
}) {
  const z = (row - 1) * 70 + offset;
  const slices = useMemo(() => sectionsAtHeight(bricks, z), [bricks, z]);
  const underneath = useMemo(
    () => (previous && row > 1 ? sectionsAtHeight(bricks, z - 70) : []),
    [bricks, z, previous, row]
  );
  const labels = useMemo(() => partNumbers(bricks), [bricks]);
  const [measure, setMeasure] = useState(false);
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  return (
    <div className="exact-section">
      {measurement && (
        <div className="section-tools">
          <button
            type="button"
            aria-pressed={measure}
            onClick={() => {
              setMeasure(!measure);
              setPoints([]);
            }}
          >
            {measure ? "Закончить измерение" : "Измерить две точки"}
          </button>
          <span>Z = {z.toFixed(1)} мм · точное сечение</span>
        </div>
      )}
      <svg
        viewBox={`-20 -20 ${grid.cols * 125 + 40} ${grid.rows * 125 + 40}`}
        aria-label={`Точное сечение ряда ${row}`}
        onPointerUp={(e) => {
          if (!measure) return;
          const matrix = e.currentTarget.getScreenCTM();
          if (!matrix) return;
          const p = e.currentTarget.createSVGPoint();
          p.x = e.clientX;
          p.y = e.clientY;
          const local = p.matrixTransform(matrix.inverse());
          setPoints((p) => (p.length === 1 ? [...p, { x: local.x, y: local.y }] : [{ x: local.x, y: local.y }]));
        }}
      >
        <title>
          Сечение ряда {row}, Z = {z} мм
        </title>
        {underneath.map((s) => (
          <path
            key={`prev-${s.brick.id}`}
            d={s.outline}
            fill="none"
            stroke="#167e89"
            strokeDasharray="8 5"
            opacity="0.45"
            strokeWidth="3"
          />
        ))}
        {slices.map((s) => (
          <g key={s.brick.id}>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: Optional callback enables keyboard/pointer selection; printed paths deliberately have no interactive role. */}
            <path
              d={s.path}
              role={onSelect ? "button" : undefined}
              tabIndex={onSelect ? 0 : undefined}
              aria-label={`Деталь ${labels.get(s.brick.id)}, ряд установки ${s.brick.row}`}
              fill={
                selectedIds.includes(s.brick.id)
                  ? "#167e89"
                  : s.brick.custom?.material === "steel"
                    ? "#87949a"
                    : "#dec19f"
              }
              stroke="none"
              onClick={() => {
                if (!measure) onSelect?.([s.brick.id], row);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.([s.brick.id], row);
                }
              }}
            >
              <title>
                № {labels.get(s.brick.id)} · {s.brick.custom?.name ?? s.brick.kind} · установка в ряду {s.brick.row}
              </title>
            </path>
            <path
              d={s.outline}
              fill="none"
              stroke={selectedIds.includes(s.brick.id) ? "#063e44" : "#735c48"}
              strokeWidth="1.5"
              pointerEvents="none"
            />
            {numbers && (
              <text
                x={s.center.x}
                y={s.center.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="16"
                fill="#241a12"
                pointerEvents="none"
              >
                {labels.get(s.brick.id)}
              </text>
            )}
          </g>
        ))}
        {measure && points.length > 0 && (
          <g stroke="#175a9b" fill="#175a9b" pointerEvents="none">
            {points.map((p, i) => (
              <circle key={`${i}:${p.x}`} cx={p.x} cy={p.y} r="6" />
            ))}
            {points.length === 2 && (
              <line x1={points[0].x} y1={points[0].y} x2={points[1].x} y2={points[1].y} strokeWidth="3" />
            )}
          </g>
        )}
      </svg>
      {measure && (
        <output>
          {points.length === 2
            ? `${Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y).toFixed(1)} мм между указанными точками`
            : "Укажите две точки на сечении. Масштаб учитывается; привязки к граням нет."}
        </output>
      )}
    </div>
  );
}
