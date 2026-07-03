import type { Translate } from "../../i18n";
import type { CustomBrickSpec, NotchCorner, Orientation, SnapStep, ToolKind, ViewMode } from "../../domain/types";
import { TOOLS } from "../../domain/constants";
import { notchedShape } from "../../domain/outline";
import { getToolColor, toolLabelKey } from "../../domain/tools";
import { PlateSizePanel } from "./PlateSizePanel";
import { DoorSizePanel } from "./DoorSizePanel";

export function Toolbox({ t, activeTool, setActiveTool, orientation, setOrientation, notchCorner, setNotchCorner, snapStep, setSnapStep, viewMode, setViewMode, customBricks, activeCustom, onPickCustom, onRemoveCustom, onOpenCutter, plateSpec, setPlateSize, doorSpec, setDoorSize }: { t: Translate; activeTool: ToolKind; setActiveTool: (tool: ToolKind) => void; orientation: Orientation; setOrientation: (orientation: Orientation) => void; notchCorner: NotchCorner; setNotchCorner: (corner: NotchCorner) => void; snapStep: SnapStep; setSnapStep: (step: SnapStep) => void; viewMode: ViewMode; setViewMode: (mode: ViewMode) => void; customBricks: Array<{ id: string; spec: CustomBrickSpec }>; activeCustom: CustomBrickSpec | null; onPickCustom: (spec: CustomBrickSpec) => void; onRemoveCustom: (id: string) => void; onOpenCutter: () => void; plateSpec: CustomBrickSpec; setPlateSize: (lengthMm: number, widthMm: number, thicknessMm: number, flush: boolean) => void; doorSpec: CustomBrickSpec; setDoorSize: (widthMm: number, heightMm: number) => void }) {
  return (
    <section className="space-y-2">
      <div className="rounded-[24px] border-2 border-[#3D2B1F]/10 bg-[#FFF7E8] p-2">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="text-xs font-black uppercase tracking-wide text-[#3D2B1F]/55">{t("tools")}</div>
          <button onClick={onOpenCutter} className="min-h-9 rounded-2xl border-2 border-[#C1440E]/40 px-3 text-xs font-black text-[#C1440E]">✂ {t("cutterOpen")}</button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:flex-wrap md:overflow-visible" role="group" aria-label={t("tools")}>
          {TOOLS.map((tool) => (
            <button
              key={tool}
              onClick={() => setActiveTool(tool)}
              aria-pressed={activeTool === tool}
              aria-label={t(toolLabelKey(tool))}
              className={`min-h-[58px] min-w-[78px] rounded-2xl border-2 px-2 text-[11px] font-black transition ${activeTool === tool ? "border-[#3D2B1F] bg-[#3D2B1F] text-[#F5E6C8]" : "border-[#3D2B1F]/10 bg-[#F5E6C8] text-[#3D2B1F]"}`}
            >
              <span className="mx-auto mb-1 block h-4 w-9 rounded-md border border-[#3D2B1F]/40" style={{ backgroundColor: getToolColor(tool) }} aria-hidden="true" />
              {t(toolLabelKey(tool))}
            </button>
          ))}
        </div>
        {customBricks.length > 0 && (
          <div className="mt-2 border-t border-[#3D2B1F]/10 pt-2">
            <div className="mb-1.5 px-1 text-[11px] font-black uppercase tracking-wide text-[#3D2B1F]/55">{t("cutterPalette")}</div>
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:flex-wrap md:overflow-visible">
              {customBricks.map((item) => {
                // сравнение по имени спецификации: ссылки на spec после перемонтирования
                // (перезагрузка палитры из localStorage) разные, подсветка должна выживать
                const active = activeTool === "custom" && activeCustom?.name === item.spec.name;
                return (
                  <div key={item.id} className="relative shrink-0">
                    <button
                      onClick={() => onPickCustom(item.spec)}
                      aria-pressed={active}
                      className={`min-h-[58px] min-w-[86px] rounded-2xl border-2 px-2 pb-1 text-[10px] font-black transition ${active ? "border-[#3D2B1F] bg-[#3D2B1F] text-[#F5E6C8]" : "border-[#3D2B1F]/10 bg-[#F5E6C8] text-[#3D2B1F]"}`}
                    >
                      <CustomBrickPreview spec={item.spec} />
                      <span className="block max-w-[110px] truncate">{item.spec.name}</span>
                    </button>
                    <button
                      onClick={() => onRemoveCustom(item.id)}
                      aria-label={t("deleteProject")}
                      className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[#3D2B1F]/70 text-[10px] font-black text-[#F5E6C8]"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <p className="mt-1 px-1 text-xs font-bold leading-4 text-[#3D2B1F]/65">{t("paletteHint")}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Segmented title={t("orientation")} options={[{ key: "h", label: t("horizontal") }, { key: "v", label: t("vertical") }]} value={orientation} onChange={(value) => setOrientation(value as Orientation)} />
        <Segmented title={t("viewMode")} options={[{ key: "2d", label: t("view2d") }, { key: "3d", label: t("view3d") }]} value={viewMode} onChange={(value) => setViewMode(value as ViewMode)} />
        <Segmented title={t("snapTitle")} options={[{ key: "1", label: t("snapWhole") }, { key: "0.5", label: t("snapHalf") }]} value={String(snapStep)} onChange={(value) => setSnapStep(Number(value) as SnapStep)} />
      </div>
      {activeTool === "plate" && <PlateSizePanel t={t} plateSpec={plateSpec} setPlateSize={setPlateSize} />}
      {activeTool === "cleanout" && <DoorSizePanel t={t} doorSpec={doorSpec} setDoorSize={setDoorSize} />}
      {activeTool === "rebate" && (
        <Segmented
          title={t("notchCornerTitle")}
          options={[
            { key: "nw", label: "◰ " + t("notchNW") },
            { key: "ne", label: "◳ " + t("notchNE") },
            { key: "sw", label: "◱ " + t("notchSW") },
            { key: "se", label: "◲ " + t("notchSE") },
            { key: "n", label: "⬒ " + t("notchN") },
            { key: "e", label: "◨ " + t("notchE") },
            { key: "s", label: "⬓ " + t("notchS") },
            { key: "w", label: "◧ " + t("notchW") }
          ]}
          value={notchCorner}
          onChange={(value) => setNotchCorner(value as NotchCorner)}
        />
      )}
    </section>
  );
}

/** Мини-превью формы нарезанного кирпича для чипа палитры. */
function CustomBrickPreview({ spec }: { spec: CustomBrickSpec }) {
  const scale = 34 / 2; // 2 ячейки (полный кирпич) = 34px
  const W = spec.w * scale;
  const H = spec.h * scale;
  // контур «габарит минус вырез» — общий polygon-builder (domain/outline)
  const shape = notchedShape({ x1: 0, y1: 0, x2: spec.w, y2: spec.h }, spec.notch ?? null);
  return (
    <svg className="mx-auto mb-1 block" width={38} height={22} viewBox={`${-1} ${-1} ${Math.max(W, 36) + 2} ${Math.max(H, 18) + 2}`}>
      {shape.kind === "polygon"
        ? <path d={`M${shape.points.map(([x, y]) => `${x * scale} ${y * scale}`).join(" L")} Z`} fill={getToolColor("custom")} stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
        : <rect x={shape.rect.x1 * scale} y={shape.rect.y1 * scale} width={(shape.rect.x2 - shape.rect.x1) * scale} height={(shape.rect.y2 - shape.rect.y1) * scale} rx="2" fill={getToolColor("custom")} stroke="currentColor" strokeWidth="1" />}
    </svg>
  );
}

function Segmented({ title, options, value, onChange }: { title: string; options: Array<{ key: string; label: string }>; value: string; onChange: (value: string) => void }) {
  return (
    <div className="rounded-[22px] border border-[#3D2B1F]/10 bg-[#FFF7E8] p-2">
      <div className="mb-2 px-1 text-[11px] font-black uppercase tracking-wide text-[#3D2B1F]/55">{title}</div>
      <div className="grid grid-cols-2 gap-1.5" role="group" aria-label={title}>
        {options.map((option) => (
          <button
            key={option.key}
            onClick={() => onChange(option.key)}
            aria-pressed={value === option.key}
            className={`min-h-10 rounded-2xl px-2 text-[11px] font-black transition ${value === option.key ? "bg-[#3D2B1F] text-[#F5E6C8]" : "bg-[#F5E6C8] text-[#3D2B1F]"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
